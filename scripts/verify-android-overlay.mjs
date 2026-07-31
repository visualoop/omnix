#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const overlay = resolve(root, "src-tauri/mobile/android-overlay");
const generated = resolve(root, "src-tauri/gen/android");
const generatedMode = process.argv.includes("--generated");
const failures = [];

const read = (path) => readFileSync(resolve(root, path), "utf8");
const fail = (message) => failures.push(message);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) fail(`missing ${path}`);
};

const required = [
  "src-tauri/mobile/android-toolchain.env",
  "src-tauri/mobile/android-overlay/android-contract.json",
  "src-tauri/mobile/android-overlay/android-contract.schema.json",
  "src-tauri/mobile/android-overlay/NATIVE_CONTRACT.md",
  "src-tauri/mobile/android-overlay/CI_ANDROID.md",
  "src-tauri/mobile/android-overlay/THIRD_PARTY_NOTICES.md",
  "src-tauri/mobile/android-overlay/NOTICE-WIREGUARD",
  "src-tauri/mobile/android-overlay/android-dependencies.gradle.kts.snippet",
  "src-tauri/mobile/android-overlay/android-settings.gradle.kts.snippet",
  "src-tauri/mobile/android-overlay/release-signing.gradle.kts.snippet",
  "src-tauri/mobile/android-overlay/AndroidManifest.xml.snippet",
  "src-tauri/mobile/android-overlay/AndroidManifest.direct-apk.xml",
  "src-tauri/mobile/android-overlay/omnix_file_paths.xml",
  "src-tauri/mobile/android-overlay/omnix_network_security_config.xml",
  "src-tauri/mobile/android-overlay/permissions.toml",
  "src-tauri/src/mobile/mod.rs",
  "src/platform/android-contract.ts",
  "src/platform/android-adapters.ts",
];
required.forEach(requireFile);

if (!existsSync(resolve(overlay, "android-contract.json"))) {
  fail("contract unavailable");
} else {
  const contract = JSON.parse(read("src-tauri/mobile/android-overlay/android-contract.json"));
  if (contract.androidOnly !== true) fail("contract is not Android-only");
  if (contract.pluginId !== "omnix-mobile") fail("plugin id drifted");
  if (new Set(contract.commands).size !== contract.commands.length) fail("duplicate contract command");
  if (new Set(contract.events).size !== contract.events.length) fail("duplicate contract event");
  if (contract.wireGuardCoordinate !== "com.wireguard.android:tunnel:1.0.20260102") {
    fail("WireGuard coordinate drifted");
  }

  const ts = read("src/platform/android-contract.ts");
  const rust = read("src-tauri/src/mobile/mod.rs");
  const permissions = read("src-tauri/mobile/android-overlay/permissions.toml");
  for (const command of contract.commands) {
    if (!ts.includes(`\"${command}\"`)) fail(`TypeScript command missing: ${command}`);
    if (!new RegExp(`forward_command!\\(\\s*${escapeRegExp(command)}\\s*,`).test(rust)) {
      fail(`Rust forwarder missing: ${command}`);
    }
    if (!permissions.includes(`\"${command}\"`)) fail(`permission missing: ${command}`);
  }
  for (const event of contract.events) {
    if (!ts.includes(`\"${event}\"`)) fail(`TypeScript event missing: ${event}`);
  }

  const dependencies = read("src-tauri/mobile/android-overlay/android-dependencies.gradle.kts.snippet");
  const wireguardMatches = dependencies.match(/com\.wireguard\.android:tunnel:[^\"]+/g) ?? [];
  if (wireguardMatches.length !== 1 || wireguardMatches[0] !== contract.wireGuardCoordinate) {
    fail("WireGuard dependency must occur exactly once at the pinned coordinate");
  }

  const baseManifest = read("src-tauri/mobile/android-overlay/AndroidManifest.xml.snippet");
  for (const permission of contract.forbiddenPermissions) {
    if (baseManifest.includes(permission)) fail(`forbidden base permission: ${permission}`);
  }
  if (baseManifest.includes("REQUEST_INSTALL_PACKAGES")) {
    fail("base/AAB manifest contains direct-APK installer permission");
  }
  const directManifest = read("src-tauri/mobile/android-overlay/AndroidManifest.direct-apk.xml");
  if (!directManifest.includes("REQUEST_INSTALL_PACKAGES")) fail("direct APK permission is missing");
}

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});
for (const path of walk(overlay)) {
  const rel = relative(overlay, path);
  if (/(^|\/)(ios|apple)(\/|$)/i.test(rel) || /\.swift$|\.xcodeproj/i.test(rel)) {
    fail(`iOS artifact in Android overlay: ${rel}`);
  }
}

if (generatedMode) {
  const generatedRequired = [
    "src-tauri/gen/android/app/build.gradle.kts",
    "src-tauri/gen/android/app/src/main/AndroidManifest.xml",
    "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/mobile/OmnixMobilePlugin.kt",
  ];
  generatedRequired.forEach(requireFile);
} else if (existsSync(generated)) {
  fail("generated Android project exists before approved x86_64 initialization");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[fail] ${failure}`);
  console.error(`Android overlay check failed with ${failures.length} issue(s).`);
  process.exit(1);
}
console.log(`Android overlay check passed (${generatedMode ? "generated" : "source"} mode).`);
