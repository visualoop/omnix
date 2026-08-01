import { describe, expect, it, vi } from "vitest";
import {
  AndroidHubError,
  diagnosticFor,
  loadAndroidHub,
  pairAndroidHub,
  type AndroidHubBridge,
  type AndroidHubResponse,
} from "@/mobile/android-hub";

const NODE = "11111111-1111-4111-8111-111111111111";
const BRANCH = "22222222-2222-4222-8222-222222222222";

function bridge(input: {
  saved?: string | null;
  responses?: AndroidHubResponse[];
  requestError?: Error;
} = {}): AndroidHubBridge & { savedValues: string[] } {
  const responses = [...(input.responses ?? [])];
  const savedValues: string[] = [];
  return {
    savedValues,
    discover: vi.fn().mockResolvedValue([]),
    request: vi.fn().mockImplementation(async () => {
      if (input.requestError) throw input.requestError;
      const response = responses.shift();
      if (!response) throw new Error("No mock response");
      return response;
    }),
    load: vi.fn().mockResolvedValue(input.saved ?? null),
    save: vi.fn().mockImplementation(async (value: string) => { savedValues.push(value); }),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

const pairingInput = {
  host: "192.168.1.20",
  port: "8765",
  code: "123456",
  deviceName: "Front counter phone",
  fingerprint: "android-test-device",
};

describe("Android first run", () => {
  it("shows enrollment when no hub is configured", async () => {
    await expect(loadAndroidHub(bridge())).resolves.toBeNull();
  });

  it("classifies an unreachable hub with an actionable retry state", async () => {
    await expect(pairAndroidHub(pairingInput, bridge({ requestError: new Error("connection refused") })))
      .rejects.toMatchObject({ kind: "hub-unreachable", message: "connection refused" });
  });

  it("keeps a rejected or expired pairing code distinct from network failure", async () => {
    const pending = pairAndroidHub(pairingInput, bridge({ responses: [
      { status: 200, body: { ok: true, service: "omnix" } },
      { status: 400, body: { error: "Invalid or expired pairing code" } },
    ] }));
    await expect(pending).rejects.toMatchObject({
      kind: "pairing-rejected",
      message: "Invalid or expired pairing code",
    });
  });

  it("persists an accepted hub without storing the legacy pairing token", async () => {
    const mock = bridge({ responses: [
      { status: 200, body: { ok: true, service: "omnix" } },
      {
        status: 200,
        body: {
          token: "legacy-token-must-not-be-persisted",
          node_id: NODE,
          business_name: "Afya Pharmacy",
          branches: [{ id: BRANCH, code: "MAIN", name: "Main Branch" }],
          country_code: "KE",
          active_module: "dawa",
        },
      },
    ] });

    const paired = await pairAndroidHub(pairingInput, mock);
    expect(paired).toMatchObject({
      baseUrl: "http://192.168.1.20:8765",
      nodeId: NODE,
      businessName: "Afya Pharmacy",
      session: null,
    });
    expect(mock.savedValues).toHaveLength(1);
    expect(mock.savedValues[0]).not.toContain("legacy-token-must-not-be-persisted");
  });

  it("treats local database unavailability as non-blocking for a hub client", () => {
    const diagnostic = diagnosticFor(new Error("plugin:sql|load not allowed by ACL: local database unavailable"));
    expect(diagnostic).toEqual({
      kind: "database-unavailable",
      title: "Local database unavailable",
      message: "Android uses the branch hub as its source of record. Connect to a hub below; a local business database is not required.",
      retryable: true,
    });
    expect(new AndroidHubError("database-unavailable", diagnostic.message).kind).toBe("database-unavailable");
  });
});
