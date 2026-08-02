import { describe, expect, it, vi } from "vitest";
import { createAndroidPlatformAdapters, type AndroidNativeBridge } from "@/platform/android-adapters";
import { ANDROID_COMMANDS, ANDROID_EVENTS, validateApkUpdateRequest } from "@/platform/android-contract";
import type { AndroidCommand, AndroidEvent } from "@/platform/android-contract";

class FakeBridge implements AndroidNativeBridge {
  readonly calls: Array<{ command: AndroidCommand; payload?: Record<string, unknown> }> = [];
  readonly results = new Map<AndroidCommand, unknown>();
  readonly listeners = new Map<AndroidEvent, (payload: unknown) => void>();

  async invoke(command: AndroidCommand, payload?: Record<string, unknown>): Promise<unknown> {
    this.calls.push({ command, payload });
    return this.results.get(command) ?? {};
  }

  async listen(event: AndroidEvent, listener: (payload: unknown) => void): Promise<() => void> {
    this.listeners.set(event, listener);
    return () => this.listeners.delete(event);
  }

  emit(event: AndroidEvent, payload: unknown): void {
    this.listeners.get(event)?.(payload);
  }
}

describe("Android Tauri adapter", () => {
  it("keeps permission query and request as distinct native calls", async () => {
    const bridge = new FakeBridge();
    bridge.results.set(ANDROID_COMMANDS.scannerPermission, "prompt-with-rationale");
    bridge.results.set(ANDROID_COMMANDS.scannerRequestPermission, "denied");
    const adapters = createAndroidPlatformAdapters(bridge);

    await expect(adapters.scanner.permission()).resolves.toBe("prompt");
    await expect(adapters.scanner.requestPermission()).resolves.toBe("denied");
    expect(bridge.calls.map((call) => call.command)).toEqual([
      ANDROID_COMMANDS.scannerPermission,
      ANDROID_COMMANDS.scannerRequestPermission,
    ]);
  });

  it("normalizes secure keys and never creates an insecure fallback", async () => {
    const bridge = new FakeBridge();
    bridge.results.set(ANDROID_COMMANDS.secureStorageGet, { value: "ciphertext-was-decrypted-natively" });
    const adapters = createAndroidPlatformAdapters(bridge);

    await expect(adapters.secureStorage.get({
      namespace: "session",
      accountId: " account-1 ",
      name: " refresh-token ",
    })).resolves.toBe("ciphertext-was-decrypted-natively");
    expect(bridge.calls[0].payload).toEqual({
      key: { namespace: "session", accountId: "account-1", name: "refresh-token" },
    });
    await expect(adapters.secureStorage.set(
      { namespace: "mesh", accountId: "../account", name: "private-key" },
      "secret",
    )).rejects.toThrow("accountId");
  });

  it("shares only opaque app-owned attachment ids", async () => {
    const bridge = new FakeBridge();
    bridge.results.set(ANDROID_COMMANDS.share, { completed: true });
    const adapters = createAndroidPlatformAdapters(bridge);

    await expect(adapters.share.share({
      title: "Receipt",
      attachments: [{ attachmentId: "receipt-42", mimeType: "application/pdf", displayName: "Receipt 42.pdf" }],
    })).resolves.toEqual({ completed: true });
    expect(JSON.stringify(bridge.calls[0].payload)).not.toContain("file://");
    await expect(adapters.share.share({ title: "Empty" })).rejects.toThrow("no content");
  });

  it("acknowledges predictive back exactly once with the handler result", async () => {
    const bridge = new FakeBridge();
    const handler = vi.fn(async () => true);
    const adapters = createAndroidPlatformAdapters(bridge);
    const unsubscribe = await adapters.lifecycle.onBackRequested(handler);

    bridge.emit(ANDROID_EVENTS.backRequested, { requestId: "back-1", canGoBack: true });
    await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(bridge.calls).toContainEqual({
      command: ANDROID_COMMANDS.lifecycleCompleteBack,
      payload: { requestId: "back-1", handled: true },
    }));
    unsubscribe();
    expect(bridge.listeners.has(ANDROID_EVENTS.backRequested)).toBe(false);
  });

  it("keeps VPN consent denial distinct from a disabled tunnel", async () => {
    const bridge = new FakeBridge();
    bridge.results.set(ANDROID_COMMANDS.meshAvailability, { state: "permission-required", permission: "vpn" });
    bridge.results.set(ANDROID_COMMANDS.meshStatus, {
      state: "permission-denied",
      nodeId: null,
      hubName: null,
      lastHandshakeAt: null,
    });
    const adapters = createAndroidPlatformAdapters(bridge);

    await expect(adapters.mesh.availability()).resolves.toEqual({ state: "permission-required", permission: "vpn" });
    await expect(adapters.mesh.status()).resolves.toMatchObject({ state: "permission-denied" });
  });
});

describe("direct APK update request validation", () => {
  const valid = {
    releaseId: "release-73",
    versionName: "0.73.0",
    versionCode: 73,
    downloadUrl: "https://media.omnix.co.ke/releases/v0.73.0/omnix.apk",
    sha256: "a".repeat(64),
    signingCertificateSha256: "B".repeat(64),
    sizeBytes: 1024,
  } as const;

  it("allows only signed Omnix HTTPS release inputs", () => {
    expect(validateApkUpdateRequest(valid)).toMatchObject({
      signingCertificateSha256: "b".repeat(64),
      versionCode: 73,
    });
    expect(() => validateApkUpdateRequest({
      ...valid,
      downloadUrl: "https://attacker.example/omnix.apk",
    })).toThrow("not allowlisted");
    expect(() => validateApkUpdateRequest({ ...valid, sha256: "abc" })).toThrow("digest");
    expect(() => validateApkUpdateRequest({ ...valid, versionCode: 0 })).toThrow("Version code");
  });
});
