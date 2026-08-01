#!/usr/bin/env python3
"""Structural regression checks for the signed desktop release pipeline."""
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "ci.yml"
workflow = yaml.safe_load(WORKFLOW.read_text())
jobs = workflow["jobs"]

assert "rust-tests" in jobs, "shared Rust tests must be isolated from the variant matrix"
rust_steps = jobs["rust-tests"]["steps"]
rust_runs = [step.get("run", "") for step in rust_steps]
assert any(run == "pnpm build" for run in rust_runs), "Tauri test build.rs requires ../dist"
assert any(run == "cargo test --lib --locked" for run in rust_runs)

build = jobs["build"]
assert build.get("needs") == "rust-tests", "all desktop variants must share the same test gate"
build_steps = build["steps"]
assert not any("cargo test" in step.get("run", "") for step in build_steps), (
    "a single matrix variant must not own shared Rust tests"
)

cache = next(step for step in build_steps if step.get("name") == "Cache Rust build artifacts")
assert cache["with"]["key"] == "build-${{ matrix.variant }}"
assert "save-if" not in cache["with"], "variant-specific keys are safe for every job to save"

notify = next(
    step for step in build_steps
    if step.get("name") == "Notify and verify release API (variant=${{ matrix.variant }})"
)
assert not notify.get("continue-on-error", False), "metadata publication must fail the release"
notify_run = notify["run"]
for required in (
    "PAYLOAD_SYSTEM_TOKEN is required",
    "signatureStored == true",
    "/api/releases-latest?variant=$VARIANT&license=0.0.0",
    '.platforms["windows-x86_64"].signature == $sig',
):
    assert required in notify_run, f"missing release verification: {required}"

inputs = workflow.get("on", workflow.get(True))["workflow_dispatch"]["inputs"]
assert inputs["release_variant"]["default"] == "all"
assert "release_variant" in build["strategy"]["matrix"]["variant"]

checkout = next(step for step in build_steps if step.get("name") == "Checkout release source")
assert checkout["with"]["ref"] == "${{ inputs.release_version || github.ref }}", (
    "repair builds must compile the immutable existing tag"
)

print("release workflow structure: OK")
