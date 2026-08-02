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


describe("Android native scanner and direct APK services", () => {
  it("keeps reviewed native sources mirrored into generated Android output", () => {
    for (const [source, generated] of [
      ["src-tauri/mobile/android-overlay/OmnixMobilePlugin.kt", "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/mobile/OmnixMobilePlugin.kt"],
      ["src-tauri/mobile/android-overlay/BarcodeCaptureSession.kt", "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/mobile/BarcodeCaptureSession.kt"],
      ["src-tauri/mobile/android-overlay/DirectApkUpdater.kt", "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/mobile/DirectApkUpdater.kt"],
      ["src-tauri/mobile/android-overlay/OmnixMeshService.kt", "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/mobile/OmnixMeshService.kt"],
      ["src-tauri/mobile/android-overlay/MainActivity.kt", "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/MainActivity.kt"],
    ]) {
      expect(read(generated)).toBe(read(source));
    }
  });

  it("uses CameraX with bundled ML Kit and releases capture on cancellation or pause", () => {
    const scanner = read("src-tauri/mobile/android-overlay/BarcodeCaptureSession.kt");
    const plugin = read("src-tauri/mobile/android-overlay/OmnixMobilePlugin.kt");
    expect(scanner).toContain("ProcessCameraProvider");
    expect(scanner).toContain("BarcodeScanning.getClient");
    expect(scanner).toContain("STRATEGY_KEEP_ONLY_LATEST");
    expect(scanner).toContain("cameraProvider?.unbindAll()");
    expect(plugin).toContain("scannerCapture.cancel()");
    expect(plugin).not.toContain("fun scannerScan(invoke: Invoke) = invoke.resolve(null)");
  });

  it("pins, downloads, hashes and signer-verifies updates before explicit installer handoff", () => {
    const updater = read("src-tauri/mobile/android-overlay/DirectApkUpdater.kt");
    const plugin = read("src-tauri/mobile/android-overlay/OmnixMobilePlugin.kt");
    expect(updater).toContain("c7f91eb28f7b6c6b23781382dc30b8c360cb2780d8c6b74db9ff07013fcd08bb");
    expect(updater).toContain("https://omnix.co.ke/api/releases/latest");
    expect(updater).toContain('MessageDigest.getInstance("SHA-256")');
    expect(updater).toContain("getPackageArchiveInfo");
    expect(updater).toContain("GET_SIGNING_CERTIFICATES");
    expect(updater).toContain("FileProvider.getUriForFile");
    expect(updater).toContain("installer.component = ComponentName");
    expect(plugin).not.toContain('fun apkUpdateStage(invoke: Invoke) = invoke.reject');
    expect(plugin).not.toContain('fun apkUpdateInstall(invoke: Invoke) = invoke.reject');
  });
});


describe("Android WireGuard private mesh", () => {
  it("uses VPN consent and a persistent foreground service instead of disabled stubs", () => {
    const plugin = read("src-tauri/mobile/android-overlay/OmnixMobilePlugin.kt");
    const service = read("src-tauri/mobile/android-overlay/OmnixMeshService.kt");
    const activity = read("src-tauri/mobile/android-overlay/MainActivity.kt");
    expect(plugin).toContain("VpnService.prepare(activity)");
    expect(plugin).toContain('PublicMeshState("permission-denied")');
    expect(plugin).toContain("OmnixMeshRuntime.start");
    expect(plugin).not.toContain("Private Mesh enrollment is unavailable");
    expect(activity).toContain("ActivityResultContracts.StartActivityForResult()");
    expect(service).toContain('PublicMeshState("starting", enrollment.nodeId');
    expect(service).not.toContain('PublicMeshState("connected", enrollment.nodeId');
    expect(service).toContain('state = "offline"');
    expect(service).toContain("class OmnixMeshService : Service()");
    expect(service).toContain("startForeground(MESH_NOTIFICATION_ID, notification())");
    expect(service).toContain("setOngoing(true)");
  });

  it("keeps device credentials in Android Keystore and rejects broad routes", () => {
    const service = read("src-tauri/mobile/android-overlay/OmnixMeshService.kt");
    expect(service).toContain('KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256, KEYSTORE)');
    expect(service).toContain('"0.0.0.0/0"');
    expect(service).toContain('"::/0"');
    expect(service).toContain("pool.contains(route)");
    expect(service).not.toContain("putString(\"privateKey\"");
    expect(service).not.toContain("getString(\"privateKey\"");
  });

  it("handles reboot, Doze, network handoff, rotation and terminal revocation", () => {
    const service = read("src-tauri/mobile/android-overlay/OmnixMeshService.kt");
    expect(service).toContain("class OmnixMeshBootReceiver");
    expect(service).toContain("registerDefaultNetworkCallback");
    expect(service).toContain("PowerManager.ACTION_DEVICE_IDLE_MODE_CHANGED");
    expect(service).toContain('lifecycle == "rotation_pending"');
    expect(service).toContain('lifecycle == "revoked"');
    expect(service).toContain("MeshKeyCustody.revoke");
    expect(service).toContain("LIFECYCLE_RECHECK_MILLIS");
    expect(service).toContain("reconcileConsent");
    expect(service).toContain("MeshKeyCustody.retire");
  });
});
