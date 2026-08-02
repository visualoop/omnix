import { describe, expect, it, vi } from "vitest";
import {
  AndroidHubError,
  diagnosticFor,
  loadAndroidHub,
  loginAndroidHub,
  pairAndroidHub,
  type AndroidHubBridge,
  type AndroidHubConfig,
  type AndroidPrivateMeshBridge,
  type AndroidHubResponse,
} from "@/mobile/android-hub";
const USER = "33333333-3333-4333-8333-333333333333";

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

  it("protects the peer configuration, starts the tunnel, and switches hub traffic to its mesh address", async () => {
    const hubKey = Buffer.alloc(32, 11).toString("base64");
    const deviceKey = Buffer.alloc(32, 7).toString("base64");
    const config: AndroidHubConfig = {
      version: 1,
      baseUrl: "http://192.168.1.20:8765",
      lanBaseUrl: "http://192.168.1.20:8765",
      nodeId: NODE,
      businessName: "Afya Pharmacy",
      branches: [{ id: BRANCH, code: "MAIN", name: "Main Branch" }],
      countryCode: "KE",
      activeModule: "dawa",
      meshEnrollmentId: null,
      session: null,
    };
    const hub = bridge({ responses: [{
      status: 200,
      body: {
        accessToken: "a".repeat(48),
        userId: USER,
        fullName: "Alice Kinoti",
        role: "manager",
        branchId: BRANCH,
        assignedBranchIds: [BRANCH],
        permissions: ["inventory.view"],
        enabledModules: ["core", "dawa"],
        expiresAt: "2026-08-02T20:00:00Z",
        meshEnrollment: {
          enrollmentId: "44444444-4444-4444-8444-444444444444",
          status: "approved",
          nodeId: NODE,
          hubName: "Nairobi HQ",
          keyId: "android-key-1",
          devicePublicKey: deviceKey,
          interfaceAddress: "10.73.42.2/32",
          meshSubnet: "10.73.0.0/16",
          peerPublicKey: hubKey,
          endpoint: "hq-west.ddns.example.co.ke:51820",
          allowedIps: ["10.73.0.0/16"],
          persistentKeepaliveSeconds: 25,
          hubAddress: "10.73.0.1",
        },
      },
    }] });
    const mesh: AndroidPrivateMeshBridge = {
      configure: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue({ state: "starting", nodeId: NODE, hubName: "Nairobi HQ", lastHandshakeAt: null }),
    };

    const authenticated = await loginAndroidHub(
      config,
      { username: "alice", password: "correct horse", branchId: BRANCH },
      hub,
      mesh,
    );

    expect(mesh.configure).toHaveBeenCalledWith(expect.objectContaining({
      accountId: USER,
      branchId: BRANCH,
      enrollment: expect.objectContaining({
        interfaceAddress: "10.73.42.2/32",
        peerPublicKey: hubKey,
        endpoint: "hq-west.ddns.example.co.ke:51820",
        allowedIps: ["10.73.0.0/16"],
        persistentKeepaliveSeconds: 25,
      }),
    }));
    expect(mesh.start).toHaveBeenCalledWith({
      accountId: USER,
      branchId: BRANCH,
      enrollmentId: "44444444-4444-4444-8444-444444444444",
    });
    expect(authenticated.baseUrl).toBe("http://10.73.0.1:8765");
    expect(authenticated.lanBaseUrl).toBe("http://192.168.1.20:8765");
    expect(hub.savedValues.at(-1)).not.toContain(hubKey);
  });
});
