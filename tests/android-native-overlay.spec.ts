import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string): string => readFileSync(resolve(path), "utf8");

describe("Android native overlay contract", () => {
  it("keeps the reviewed Android project applied and all iOS output absent", () => {
    expect(existsSync(resolve("src-tauri/gen/android"))).toBe(true);
    expect(existsSync(resolve("src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/mobile/OmnixMobilePlugin.kt"))).toBe(true);
    expect(existsSync(resolve("src-tauri/gen/ios"))).toBe(false);
  });

  it("covers every requested native boundary with a unique machine-readable command", () => {
    const contract = JSON.parse(read("src-tauri/mobile/android-overlay/android-contract.json")) as {
      androidOnly: boolean;
      commands: string[];
      events: string[];
      wireGuardCoordinate: string;
    };
    expect(contract.androidOnly).toBe(true);
    expect(new Set(contract.commands).size).toBe(contract.commands.length);
    const schema = JSON.parse(read("src-tauri/mobile/android-overlay/android-contract.schema.json")) as {
      properties: { commands: { minItems: number } };
    };
    expect(contract.commands).toHaveLength(33);
    expect(schema.properties.commands.minItems).toBe(contract.commands.length);
    for (const prefix of [
      "secure_storage_", "biometric_", "scanner_", "share", "notification_",
      "mesh_", "lifecycle_", "apk_update_",
    ]) {
      expect(contract.commands.some((command) => command.startsWith(prefix))).toBe(true);
    }
    expect(contract.events).toEqual(expect.arrayContaining([
      "lifecycle", "back-requested", "apk-update-progress", "notification-opened",
    ]));
  });

  it("documents the exact non-installing init/build commands and native registration", () => {
    const handoff = read("src-tauri/mobile/android-overlay/README.md");
    expect(handoff).toContain("pnpm tauri android init --ci --skip-targets-install");
    expect(handoff).toContain("pnpm tauri android build --ci --apk --aab");
    expect(handoff).toContain("src-tauri/gen/android/app/build.gradle.kts");
    const rust = read("src-tauri/src/mobile/mod.rs");
    expect(rust).toContain('api.register_android_plugin("co.ke.omnix.app.mobile", "OmnixMobilePlugin")');
  });

  it("pins WireGuard exactly once and retains notices for every native dependency", () => {
    const dependencies = read("src-tauri/mobile/android-overlay/android-dependencies.gradle.kts.snippet");
    expect(dependencies.match(/com\.wireguard\.android:tunnel:/g)).toHaveLength(1);
    expect(dependencies).toContain('com.wireguard.android:tunnel:1.0.20260102');
    const notice = read("src-tauri/mobile/android-overlay/NOTICE-WIREGUARD");
    expect(notice).toContain("Apache Software License, Version 2.0");
    expect(read("src-tauri/mobile/android-overlay/THIRD_PARTY_NOTICES.md"))
      .toContain("com.google.mlkit:barcode-scanning");
  });

  it("isolates direct APK install permission from the base/AAB manifest", () => {
    const base = read("src-tauri/mobile/android-overlay/AndroidManifest.xml.snippet");
    const direct = read("src-tauri/mobile/android-overlay/AndroidManifest.direct-apk.xml");
    expect(base).not.toContain("REQUEST_INSTALL_PACKAGES");
    expect(direct).toContain("REQUEST_INSTALL_PACKAGES");
    for (const forbidden of ["READ_CONTACTS", "READ_SMS", "MANAGE_EXTERNAL_STORAGE", "QUERY_ALL_PACKAGES"]) {
      expect(base).not.toContain(forbidden);
      expect(direct).not.toContain(forbidden);
    }
  });

  it("declares masked signing inputs and x86_64 pinned CI gates", () => {
    const ci = read("src-tauri/mobile/android-overlay/CI_ANDROID.md");
    expect(ci).toContain("ubuntu-24.04");
    expect(ci).toContain("OMNIX_ANDROID_KEYSTORE_B64");
    expect(ci).toContain("OMNIX_ANDROID_SIGNING_CERT_SHA256");
    expect(ci).toContain("apksigner verify");
    expect(ci).toContain("bundletool validate");
    expect(ci).toContain("16 KiB");
  });
});

describe("Android least-privilege Tauri leaves", () => {
  it("uses an Android-only fail-closed capability until generated plugin permissions exist", () => {
    const capability = JSON.parse(read("src-tauri/capabilities/android-minimal.json")) as {
      identifier: string;
      local: boolean;
      windows: string[];
      platforms: string[];
      permissions: string[];
    };
    expect(capability).toMatchObject({
      identifier: "android-minimal",
      local: true,
      windows: ["main"],
      platforms: ["android"],
      permissions: ["core:default"],
    });
  });

  it("selects only the Android capability in the platform merge leaf", () => {
    const platform = JSON.parse(read("src-tauri/tauri.android.conf.json")) as {
      app: { security: { capabilities: string[] } };
    };
    expect(platform.app.security.capabilities).toEqual(["android-minimal"]);
  });
});
