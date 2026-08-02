#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const overlay = resolve(root, "src-tauri/mobile/android-overlay");
const generatedMode = process.argv.includes("--generated");
const failures = [];
const variants = ["pro", "dawa", "retail", "hospitality", "hardware", "salon"];
const activeVariant = process.env.VITE_OMNIX_VARIANT || "pro";
const densities = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"];
const launcherFiles = [
  ...densities.flatMap((density) => [
    `mipmap-${density}/ic_launcher.png`,
    `mipmap-${density}/ic_launcher_round.png`,
    `mipmap-${density}/ic_launcher_foreground.png`,
  ]),
  "mipmap-anydpi-v26/ic_launcher.xml",
  "values/ic_launcher_background.xml",
];
const rejectedLegacyLauncherHashes = new Set([
  // Tauri/Android Studio template resources and the stale blue-S icon tree
  // that previously shipped in Omnix. Keep all densities here so changing
  // only one generated launcher file cannot make a regression look reviewed.
  "01d1a6a6c1234eb7fe270d097eb283d72b9c95ae5118886f1b6573aad280f1f7",
  "0687336f0ccc6f7ee09c7c95110667c63b75931238df779a21af401fb864cd34",
  "0b250fc4451dfd1e5a41128234d93225726a2984448b0b966af25677b167d8de",
  "0b99afb5ca2ac8b4c0a33c05b0f96232c504a9a8d64d45c4426dd8c47bb8f8a6",
  "2425d59d27578f75ca97d31d9ae8385898badce3d6a1774bfc2f0fd191dc12c7",
  "27cf0cdbc78bec8b9a14eaedb084c541a3c191fe5db89766e831fbfd21ce955d",
  "309da962b2aa502c4edbd55ceb9007fb7c914b0b70d94428483f26b589063cb3",
  "320e552422179b81dae014ee6cc00561bd6e7455767b28f5518b8862a8c7987c",
  "3434b9f719b4c1051a73c4c0b8f4b50181d3c7ffb60905a149907cc8e03c093d",
  "44d78624ec9d71413326ba0b624f827a3f3ca640837cbe14650eb770619024eb",
  "44e5c3dc1dfb392f65e3dbcc9b986d30f10dd95b57e306657e56281b572fa684",
  "54e1093c61a05f1f8def2690e2bb83e362dfc99c8365be02cc76e18e69b1123b",
  "6825d01ccad0dad92243aa8e9207e67c056f88e6544384cbd5ee80a3f86edd32",
  "71b847d0743a20b177102db8d1d6af7adef91ddd5de85c60b94b02e304cc3541",
  "747741f992fc62d9de110bb6919f25e89aaa10defc9cfa01651964382ff7762f",
  "75322a261ba38a23a25647af0d1298f204f3b3fafd317b8122a1b9a1f38284ff",
  "760d4b8a06bf7163dd010c33ad2cac9e4a75fa0177afaba042f83e311eef0c3e",
  "7827d46c187aa3b97bb442b191a60ccec8fbbb43c0c28208e5654762b9f1c050",
  "7a9ae0632bfe5b28a1e6e9a7b38982fef62be07c95de46c26bd4f901ac6b9753",
  "83e91531c3640efc5271ada7a5db4c6709e861cb1d5159956781a927fb0c3deb",
  "9bb5074c4adecd54b8af89fc455b197122d01cc3e4fe4b76f8d358e084e930d4",
  "ab9397c9827aef4b3a1f1f917fc722d54abcf26488880c8bf9c724d1e59ab905",
  "b1d19b8b78d0ed6903dd35b7640afba29b4cf02f3780e0d1cd46d9ebcbc93695",
  "ca37c7ae5e9ed865aab7300dccad4bf0fd1ef9f12129bc0c2a7a3d5f9218da32",
  "dae1ff05b101efea50e4b622fe6a3af8ba8f761162fa7c4fd864adc7cb39eeac",
  "e02af0f1e6bf62c10e13232cf0ccda62e38bbc7230144a10f598cf69bd65f07c",
  "ed423c73a6f40a4d2909f0901e60527b3a807cd59e1b5593bcaae1808b1c6321",
  "eec8cac20d0410c78bda009fb9462db25b000c3dd07cc0e2a53701c6de8d510a",
  "f7ec19903877f5911688e21620b3973870e4c1664790fa45ad40d7de64494ba2",
]);

const pathFromRoot = (path) => resolve(root, path);
const read = (path) => readFileSync(pathFromRoot(path), "utf8");
const fail = (message) => failures.push(message);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const requireFile = (path) => {
  if (!existsSync(pathFromRoot(path))) fail(`missing ${path}`);
};
const sha256 = (path) => createHash("sha256").update(readFileSync(pathFromRoot(path))).digest("hex");
const requireMatch = (reviewed, copy) => {
  if (existsSync(pathFromRoot(reviewed)) && existsSync(pathFromRoot(copy)) && sha256(reviewed) !== sha256(copy)) {
    fail(`launcher resource drifted from reviewed copy: ${copy}`);
  }
};
const rejectTauriStock = (path) => {
  if (existsSync(pathFromRoot(path)) && rejectedLegacyLauncherHashes.has(sha256(path))) {
    fail(`Tauri stock launcher artwork detected: ${path}`);
  }
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
  "src-tauri/mobile/android-overlay/OmnixMobilePlugin.kt",
  "src-tauri/mobile/android-overlay/BarcodeCaptureSession.kt",
  "src-tauri/mobile/android-overlay/DirectApkUpdater.kt",
  "src-tauri/mobile/android-overlay/OmnixMeshService.kt",
  "src-tauri/mobile/android-overlay/MainActivity.kt",
  "src-tauri/src/mobile/mod.rs",
  "src/platform/android-contract.ts",
  "src/platform/android-adapters.ts",
];
required.forEach(requireFile);

if (!variants.includes(activeVariant)) {
  fail(`unknown VITE_OMNIX_VARIANT: ${activeVariant}`);
}
for (const variant of variants) {
  for (const resource of launcherFiles) {
    const reviewed = `src-tauri/icons/variants/${variant}/android/${resource}`;
    requireFile(reviewed);
    rejectTauriStock(reviewed);
  }
}
if (variants.includes(activeVariant)) {
  for (const resource of launcherFiles) {
    const reviewed = `src-tauri/icons/variants/${activeVariant}/android/${resource}`;
    const active = `src-tauri/icons/android/${resource}`;
    requireFile(active);
    requireMatch(reviewed, active);
    rejectTauriStock(active);
  }
}
const overlayManifest = "src-tauri/mobile/android-overlay/AndroidManifest.xml.snippet";
if (existsSync(pathFromRoot(overlayManifest)) && !read(overlayManifest).includes('android:roundIcon="@mipmap/ic_launcher_round"')) {
  fail("reviewed manifest overlay is missing the round launcher icon");
}

if (!existsSync(pathFromRoot("src-tauri/mobile/android-overlay/android-contract.json"))) {
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

  const baseManifest = read(overlayManifest);
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
    "src-tauri/gen/android/app/src/directApk/AndroidManifest.xml",
    "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/MainActivity.kt",
    "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/mobile/OmnixMobilePlugin.kt",
    "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/mobile/BarcodeCaptureSession.kt",
    "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/mobile/DirectApkUpdater.kt",
    "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/mobile/OmnixMeshService.kt",
  ];
  generatedRequired.forEach(requireFile);
  const mirrors = [
    ["src-tauri/mobile/android-overlay/MainActivity.kt", "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/MainActivity.kt"],
    ["src-tauri/mobile/android-overlay/OmnixMobilePlugin.kt", "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/mobile/OmnixMobilePlugin.kt"],
    ["src-tauri/mobile/android-overlay/BarcodeCaptureSession.kt", "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/mobile/BarcodeCaptureSession.kt"],
    ["src-tauri/mobile/android-overlay/DirectApkUpdater.kt", "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/mobile/DirectApkUpdater.kt"],
    ["src-tauri/mobile/android-overlay/OmnixMeshService.kt", "src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/mobile/OmnixMeshService.kt"],
  ];
  for (const [source, output] of mirrors) {
    if (existsSync(pathFromRoot(output)) && read(source) !== read(output)) fail(`generated native source drifted: ${output}`);
  }

  const generatedManifest = "src-tauri/gen/android/app/src/main/AndroidManifest.xml";
  if (existsSync(pathFromRoot(generatedManifest))) {
    if (read(generatedManifest).includes("REQUEST_INSTALL_PACKAGES")) {
      fail("generated base/AAB manifest contains direct-APK installer permission");
    }
    if (!read(generatedManifest).includes('android:roundIcon="@mipmap/ic_launcher_round"')) {
      fail("generated manifest is missing the round launcher icon");
    }
  }
  if (existsSync(pathFromRoot("src-tauri/gen/android/app/src/directApk/AndroidManifest.xml")) &&
      !read("src-tauri/gen/android/app/src/directApk/AndroidManifest.xml").includes("REQUEST_INSTALL_PACKAGES")) {
    fail("generated direct APK permission is missing");
  }

  for (const resource of launcherFiles) {
    const active = `src-tauri/icons/android/${resource}`;
    const generated = `src-tauri/gen/android/app/src/main/res/${resource}`;
    requireFile(generated);
    requireMatch(active, generated);
    rejectTauriStock(generated);
  }
  const stockVector = "src-tauri/gen/android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml";
  if (existsSync(pathFromRoot(stockVector))) {
    rejectTauriStock(stockVector);
    fail(`obsolete launcher vector must be removed: ${stockVector}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[fail] ${failure}`);
  console.error(`Android overlay check failed with ${failures.length} issue(s).`);
  process.exit(1);
}
console.log(`Android overlay check passed (${generatedMode ? "generated" : "source"} mode, ${activeVariant} launcher).`);
