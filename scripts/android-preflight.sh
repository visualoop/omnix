#!/usr/bin/env bash
# Read-only Android/Tauri environment preflight. This script never installs,
# downloads, generates, starts, or modifies anything.
set -u

readonly SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="${OMNIX_ANDROID_PREFLIGHT_ROOT:-$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)}"
readonly TOOLCHAIN_FILE="$PROJECT_ROOT/src-tauri/mobile/android-toolchain.env"
if [[ ! -f "$TOOLCHAIN_FILE" ]]; then
  printf '[fail] pinned Android toolchain file is missing: %s\n' "$TOOLCHAIN_FILE" >&2
  exit 1
fi
# shellcheck disable=SC1090 -- project-owned data file, validated by focused tests.
source "$TOOLCHAIN_FILE"
readonly REQUIRED_RUST_TARGETS=(
  aarch64-linux-android
  armv7-linux-androideabi
  i686-linux-android
  x86_64-linux-android
)

failures=0

ok() {
  printf '[ok] %s\n' "$1"
}

fail() {
  printf '[fail] %s\n' "$1" >&2
  failures=$((failures + 1))
}

require_command() {
  local command_name="$1"
  if command -v "$command_name" >/dev/null 2>&1; then
    ok "$command_name is available"
  else
    fail "$command_name is not available on PATH"
  fi
}

require_executable() {
  local path="$1"
  local label="$2"
  if [[ -x "$path" ]]; then
    ok "$label: $path"
  else
    fail "$label is missing or not executable: $path"
  fi
}

require_directory() {
  local path="$1"
  local label="$2"
  if [[ -d "$path" ]]; then
    ok "$label: $path"
  else
    fail "$label directory is missing: $path"
  fi
}

first_directory_matching() {
  local pattern="$1"
  local candidate
  for candidate in $pattern; do
    if [[ -d "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

first_executable_matching() {
  local pattern="$1"
  local candidate
  for candidate in $pattern; do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

printf 'Omnix Android preflight (read-only)\n'
printf 'Project: %s\n' "$PROJECT_ROOT"
printf 'Pinned toolchain: API %s, build-tools %s, NDK %s, Java %s, Tauri %s\n' \
  "$OMNIX_ANDROID_COMPILE_SDK" "$OMNIX_ANDROID_BUILD_TOOLS" "$OMNIX_ANDROID_NDK" \
  "$OMNIX_ANDROID_JAVA_MAJOR" "$OMNIX_TAURI_CLI"

host_arch="${OMNIX_ANDROID_PREFLIGHT_ARCH:-$(uname -m)}"
if [[ -n "${OMNIX_ANDROID_PREFLIGHT_ARCH:-}" && -z "${OMNIX_ANDROID_PREFLIGHT_ROOT:-}" ]]; then
  fail 'OMNIX_ANDROID_PREFLIGHT_ARCH is test-only and requires OMNIX_ANDROID_PREFLIGHT_ROOT'
elif [[ "$host_arch" == "$OMNIX_ANDROID_CI_ARCH" ]]; then
  ok "supported generation host architecture: $host_arch"
else
  fail "unsupported generation host architecture: $host_arch (required: $OMNIX_ANDROID_CI_ARCH)"
fi

for command_name in pnpm cargo rustc rustup; do
  require_command "$command_name"
done

if [[ -n "${JAVA_HOME:-}" ]]; then
  require_directory "$JAVA_HOME" 'JAVA_HOME'
  require_executable "$JAVA_HOME/bin/java" 'Java runtime'
  require_executable "$JAVA_HOME/bin/javac" 'Java compiler'
  java_version="$($JAVA_HOME/bin/java -version 2>&1 | head -n 1)"
  if [[ "$java_version" =~ \"${OMNIX_ANDROID_JAVA_MAJOR}([.\"]|$) ]]; then
    ok "Java major version: $OMNIX_ANDROID_JAVA_MAJOR"
  else
    fail "Java $OMNIX_ANDROID_JAVA_MAJOR is required (reported: ${java_version:-unknown})"
  fi
else
  fail 'JAVA_HOME is not set'
fi

if [[ -n "${ANDROID_HOME:-}" ]]; then
  require_directory "$ANDROID_HOME" 'ANDROID_HOME'
  require_executable "$ANDROID_HOME/platform-tools/adb" 'Android platform-tools adb'

  platform_dir="$ANDROID_HOME/platforms/android-$OMNIX_ANDROID_COMPILE_SDK"
  if [[ -d "$platform_dir" ]]; then
    ok "Android SDK platform: $platform_dir"
  else
    fail "pinned Android SDK platform is missing: $platform_dir"
  fi

  build_tools_dir="$ANDROID_HOME/build-tools/$OMNIX_ANDROID_BUILD_TOOLS"
  if [[ -d "$build_tools_dir" ]]; then
    ok "Android SDK build-tools: $build_tools_dir"
    require_executable "$build_tools_dir/aapt2" 'Android build-tools aapt2'
  else
    fail "pinned Android SDK build-tools are missing: $build_tools_dir"
  fi

  if sdkmanager="$(first_executable_matching "$ANDROID_HOME/cmdline-tools/*/bin/sdkmanager")"; then
    ok "Android command-line tools: $sdkmanager"
  else
    fail "sdkmanager is missing under $ANDROID_HOME/cmdline-tools"
  fi
else
  fail 'ANDROID_HOME is not set'
fi

if [[ -n "${NDK_HOME:-}" ]]; then
  require_directory "$NDK_HOME" 'NDK_HOME'
  if [[ -n "${ANDROID_HOME:-}" ]]; then
    expected_ndk="$ANDROID_HOME/ndk/$OMNIX_ANDROID_NDK"
    if [[ "$NDK_HOME" == "$expected_ndk" ]]; then
      ok "pinned NDK path: $NDK_HOME"
    else
      fail "NDK_HOME must equal pinned path: $expected_ndk"
    fi
  else
    fail 'NDK_HOME cannot be validated because ANDROID_HOME is not set'
  fi
  if [[ -f "$NDK_HOME/source.properties" ]]; then
    if grep -Eq "^Pkg.Revision[[:space:]]*=[[:space:]]*$OMNIX_ANDROID_NDK([[:space:]]*)$" "$NDK_HOME/source.properties"; then
      ok "NDK revision: $OMNIX_ANDROID_NDK"
    else
      fail "NDK metadata does not declare revision $OMNIX_ANDROID_NDK"
    fi
  else
    fail "NDK metadata is missing: $NDK_HOME/source.properties"
  fi
  if clang="$(first_executable_matching "$NDK_HOME/toolchains/llvm/prebuilt/*/bin/clang")"; then
    ok "NDK LLVM toolchain: $clang"
  else
    fail "NDK clang is missing under $NDK_HOME/toolchains/llvm/prebuilt"
  fi
else
  fail 'NDK_HOME is not set'
fi

if [[ -f "$PROJECT_ROOT/package.json" ]]; then
  ok "package manifest: $PROJECT_ROOT/package.json"
else
  fail "package manifest is missing: $PROJECT_ROOT/package.json"
fi
require_executable "$PROJECT_ROOT/node_modules/.bin/tauri" 'project-local Tauri CLI'
if [[ -x "$PROJECT_ROOT/node_modules/.bin/tauri" ]]; then
  tauri_version="$($PROJECT_ROOT/node_modules/.bin/tauri --version 2>/dev/null | awk '{print $NF}')"
  if [[ "$tauri_version" == "$OMNIX_TAURI_CLI" ]]; then
    ok "Tauri CLI version: $tauri_version"
  else
    fail "Tauri CLI $OMNIX_TAURI_CLI is required (reported: ${tauri_version:-unknown})"
  fi
fi

if command -v rustup >/dev/null 2>&1; then
  installed_targets="$(rustup target list --installed 2>/dev/null || true)"
  for target in "${REQUIRED_RUST_TARGETS[@]}"; do
    if grep -Fxq "$target" <<<"$installed_targets"; then
      ok "Rust target installed: $target"
    else
      fail "Rust target is not installed: $target"
    fi
  done
fi

if (( failures > 0 )); then
  printf 'Android preflight failed with %d issue(s). No changes were made.\n' "$failures" >&2
  exit 1
fi

printf 'Android preflight passed. No changes were made.\n'
