/**
 * Compact license-key (server-validated) activation tests.
 *
 * The website issues short keys like OMNIX-DAWA-XXXX-XXXX-XXXX (24 chars).
 * The desktop must:
 *   1. Recognise these as "compact" / server-validated (not RSA-signed)
 *   2. Skip local RSA verification for them
 *   3. Trust the server's /api/licensing/activate response
 *   4. Cache the entitlements in SQLite so module gating works offline
 *
 * These tests exercise the format detection + activation branch.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock @tauri-apps/api/core BEFORE importing license.ts so the invoke()
// calls inside don't try to actually IPC to Rust.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => []),
  execute: vi.fn(async () => undefined),
}));
vi.mock("@/lib/variant", () => ({
  VARIANT: "dawa",
}));

import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { query, execute } from "@/lib/db";
import { activateLicense } from "@/services/license";

const COMPACT_KEYS = [
  "OMNIX-PRO-9F3K-7TQX-2B4Z",
  "OMNIX-DAWA-4NJP-JPP0-3KJ6",
  "OMNIX-RETAIL-1234-5678-ABCD",
  "OMNIX-HOSP-AAAA-BBBB-CCCC",
  "OMNIX-HW-9999-8888-7777",
];

const RSA_KEY =
  "OMNIX-eyJraWQiOiJYWFgiLCJuYW1lIjoiVGVzdCJ9.AABBCCDD" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" +
  "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

beforeEach(() => {
  vi.clearAllMocks();
  // Default mock for get_machine_info — every test needs this.
  (invoke as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (cmd: string) => {
    if (cmd === "get_machine_info") {
      return { fingerprint: "test-fp-1234", formatted: "TEST-FP-1234" };
    }
    return null;
  });
});

describe("activateLicense — compact key (server-validated)", () => {
  it("accepts a compact key and skips RSA verification", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        authToken: "tok-abc",
        action: "registered",
        entitlements: {
          modules: ["core", "dawa"],
          variant: "dawa",
          maxDevices: 3,
          maxBranches: 1,
          status: "trial",
        },
      }),
    });

    const result = await activateLicense("OMNIX-DAWA-4NJP-JPP0-3KJ6");

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();

    // The Rust verify_license should NOT have been called for the compact key.
    expect(invoke).not.toHaveBeenCalledWith("verify_license", expect.anything());

    // Server activate endpoint hit with the variant + machine fingerprint.
    expect(fetch).toHaveBeenCalledTimes(1);
    const fetchCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body as string);
    expect(body.licenseKey).toBe("OMNIX-DAWA-4NJP-JPP0-3KJ6");
    expect(body.machineId).toBe("test-fp-1234");
    expect(body.variant).toBe("dawa");

    // Entitlements cached in SQLite.
    const insertCall = (execute as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => String(c[0]).includes("INSERT OR REPLACE INTO license"),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![1]).toContain("OMNIX-DAWA-4NJP-JPP0-3KJ6");
  });

  it("rejects a compact key when server says no (e.g. variant mismatch)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "Variant mismatch" }),
    });
    const result = await activateLicense("OMNIX-DAWA-4NJP-JPP0-3KJ6");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Variant");
    // No DB write on failure.
    expect(execute).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO license"),
      expect.anything(),
    );
  });

  it("rejects a compact key when server is unreachable (no offline fallback)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network"));
    const result = await activateLicense("OMNIX-DAWA-4NJP-JPP0-3KJ6");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/internet|server/i);
  });

  it.each(COMPACT_KEYS)("recognises %s as compact (5-segment)", async (key) => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, entitlements: { modules: ["core"], maxDevices: 1 } }),
    });
    const result = await activateLicense(key);
    expect(result.ok).toBe(true);
    // Each compact key should NOT trigger Rust RSA verification.
    expect(invoke).not.toHaveBeenCalledWith("verify_license", expect.anything());
  });
});

describe("activateLicense — RSA-signed key (legacy offline path)", () => {
  it("falls through to RSA verification for long signed keys", async () => {
    // verify_license returns valid: true with payload
    (invoke as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (cmd: string) => {
      if (cmd === "get_machine_info") return { fingerprint: "test-fp-1234", formatted: "TEST-FP-1234" };
      if (cmd === "verify_license") {
        return {
          valid: true,
          payload: { kid: "X", name: "T", email: "t@x.com", issued: "2026-01-01", maint_exp: "2027-01-01", type: "perpetual", feat: [], modules: ["core", "dawa"], max_devices: 1 },
          error: null,
        };
      }
      return null;
    });
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, entitlements: { modules: ["core", "dawa"], maxDevices: 1 } }),
    });

    const result = await activateLicense(RSA_KEY);
    expect(result.ok).toBe(true);
    // RSA verification WAS called this time (long key)
    expect(invoke).toHaveBeenCalledWith("verify_license", { key: RSA_KEY });
  });
});
