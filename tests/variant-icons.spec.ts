/**
 * Variant icons — smoke-test that the icon pipeline produced a complete,
 * non-empty, pixel-distinct icon set for every variant.
 *
 * If this fails, run `pnpm icons` and recommit.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const VARIANTS = ["pro", "dawa", "retail", "hospitality", "hardware"] as const;
const FILES = [
  "32x32.png",
  "64x64.png",
  "128x128.png",
  "128x128@2x.png",
  "256x256.png",
  "icon.ico",
];

function variantPath(variant: string, file: string): string {
  return resolve(process.cwd(), "src-tauri/icons/variants", variant, file);
}

describe("variant icons — pipeline output", () => {
  it("every variant has a complete icon set", () => {
    for (const v of VARIANTS) {
      for (const f of FILES) {
        const p = variantPath(v, f);
        expect(existsSync(p), `missing ${v}/${f}`).toBe(true);
        const size = statSync(p).size;
        // Even the 32x32.png should be > 500 bytes if the SVG rendered correctly.
        expect(size, `${v}/${f} is suspiciously small (${size}B)`).toBeGreaterThan(500);
      }
    }
  });

  it("each variant produces a distinct 128x128.png (accent recolour worked)", () => {
    const hashes = VARIANTS.map((v) => {
      const buf = readFileSync(variantPath(v, "128x128.png"));
      return createHash("sha256").update(buf).digest("hex");
    });
    expect(new Set(hashes).size, "two variants produced identical PNGs — accent swap likely failed").toBe(VARIANTS.length);
  });

  it("each variant produces a distinct icon.ico", () => {
    const hashes = VARIANTS.map((v) => {
      const buf = readFileSync(variantPath(v, "icon.ico"));
      return createHash("sha256").update(buf).digest("hex");
    });
    expect(new Set(hashes).size).toBe(VARIANTS.length);
  });
});
