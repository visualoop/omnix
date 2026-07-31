import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const SCRIPT = resolve("scripts/android-preflight.sh");
const tempRoots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "omnix-android-preflight-"));
  tempRoots.push(root);
  return root;
}

function executable(path: string, content = "#!/usr/bin/env bash\nexit 0\n"): void {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

function completeFixture(): { env: NodeJS.ProcessEnv; project: string } {
  const root = tempRoot();
  const project = join(root, "project");
  const bin = join(root, "bin");
  const javaHome = join(root, "jdk");
  const androidHome = join(root, "sdk");
  const ndkHome = join(androidHome, "ndk", "28.1.13356709");

  mkdirSync(project, { recursive: true });
  mkdirSync(join(project, "src-tauri", "mobile"), { recursive: true });
  writeFileSync(join(project, "package.json"), "{}\n");
  writeFileSync(join(project, "src-tauri", "mobile", "android-toolchain.env"), [
    "OMNIX_ANDROID_CI_ARCH=x86_64",
    "OMNIX_ANDROID_JAVA_MAJOR=17",
    "OMNIX_ANDROID_COMPILE_SDK=35",
    "OMNIX_ANDROID_BUILD_TOOLS=35.0.0",
    "OMNIX_ANDROID_NDK=28.1.13356709",
    "OMNIX_ANDROID_MIN_SDK=28",
    "OMNIX_ANDROID_TARGET_SDK=35",
    "OMNIX_TAURI_CLI=2.11.2",
    "OMNIX_ANDROID_RUST_TARGETS=aarch64-linux-android,armv7-linux-androideabi,i686-linux-android,x86_64-linux-android",
    "OMNIX_WIREGUARD_COORDINATE=com.wireguard.android:tunnel:1.0.20260102",
    "",
  ].join("\n"));
  executable(join(project, "node_modules", ".bin", "tauri"), "#!/usr/bin/env bash\necho 'tauri-cli 2.11.2'\n");

  for (const command of ["pnpm", "cargo", "rustc"]) {
    executable(join(bin, command));
  }
  executable(
    join(bin, "rustup"),
    "#!/usr/bin/env bash\nif [[ \"$*\" == \"target list --installed\" ]]; then\n" +
      "printf '%s\\n' aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android\n" +
      "fi\n",
  );

  executable(join(javaHome, "bin", "java"), "#!/usr/bin/env bash\necho 'openjdk version \"17.0.12\"' >&2\n");
  executable(join(javaHome, "bin", "javac"));
  executable(join(androidHome, "platform-tools", "adb"));
  mkdirSync(join(androidHome, "platforms", "android-35"), { recursive: true });
  executable(join(androidHome, "build-tools", "35.0.0", "aapt2"));
  executable(join(androidHome, "cmdline-tools", "latest", "bin", "sdkmanager"));
  mkdirSync(ndkHome, { recursive: true });
  writeFileSync(join(ndkHome, "source.properties"), "Pkg.Revision = 28.1.13356709\n");
  executable(join(ndkHome, "toolchains", "llvm", "prebuilt", "linux-x86_64", "bin", "clang"));

  return {
    project,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? "/usr/bin:/bin"}`,
      JAVA_HOME: javaHome,
      ANDROID_HOME: androidHome,
      NDK_HOME: ndkHome,
      OMNIX_ANDROID_PREFLIGHT_ROOT: project,
      OMNIX_ANDROID_PREFLIGHT_ARCH: "x86_64",
    },
  };
}

function snapshot(path: string): string[] {
  const entries: string[] = [];
  const walk = (directory: string, prefix = ""): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = join(prefix, entry.name);
      entries.push(relative);
      if (entry.isDirectory()) walk(join(directory, entry.name), relative);
    }
  };
  walk(path);
  return entries.sort();
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Android environment preflight", () => {
  it("passes a complete environment without mutating the project", () => {
    const fixture = completeFixture();
    const before = snapshot(fixture.project);
    const result = spawnSync("bash", [SCRIPT], { encoding: "utf8", env: fixture.env });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Android preflight passed. No changes were made.");
    expect(snapshot(fixture.project)).toEqual(before);
  });

  it("fails with actionable diagnostics when required Android state is absent", () => {
    const root = tempRoot();
    const project = join(root, "empty-project");
    mkdirSync(project);
    mkdirSync(join(project, "src-tauri", "mobile"), { recursive: true });
    writeFileSync(
      join(project, "src-tauri", "mobile", "android-toolchain.env"),
      readFileSync(resolve("src-tauri/mobile/android-toolchain.env"), "utf8"),
    );
    const result = spawnSync("bash", [SCRIPT], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        HOME: process.env.HOME,
        OMNIX_ANDROID_PREFLIGHT_ROOT: project,
        OMNIX_ANDROID_PREFLIGHT_ARCH: "x86_64",
        JAVA_HOME: "",
        ANDROID_HOME: "",
        NDK_HOME: "",
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("JAVA_HOME is not set");
    expect(result.stderr).toContain("ANDROID_HOME is not set");
    expect(result.stderr).toContain("NDK_HOME is not set");
    expect(result.stderr).toContain("No changes were made.");
  });

  it("contains no installer, downloader, generator, or server command", () => {
    const source = readFileSync(SCRIPT, "utf8");
    expect(source).not.toMatch(/\b(?:apt|apt-get|brew|curl|wget|sdkmanager|rustup)\s+(?:install|add|update|download)\b/);
    expect(source).not.toMatch(/\b(?:tauri\s+android\s+init|vite|serve|server)\b/);
  });
});
