import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ALL_LICENSE_PREFIXES, variantLicensePrefix, VARIANTS } from "@/lib/variant";
import { isCompactKey } from "@/services/license";

/**
 * Licence-key placeholders must show the shape of a real issued key.
 *
 * A real key is OMNIX-<MODULE>-XXXX-XXXX-XXXX, for example the live
 * OMNIX-HW-822A-B882-4B60. A placeholder like "OMNIX-XXXX-XXXX-XXXX-XXXX"
 * omits the module segment and adds a group, so it teaches the wrong format to
 * the person typing the key.
 */
const KEY_INPUTS = [
  "src/pages/license-activation.tsx",
  "src/pages/license.tsx",
  "src/pages/settings-licenses.tsx",
];

/**
 * Same structure the desktop validator accepts, with X standing in for a
 * character. The module segment is restricted to the tokens the platform really
 * issues, so an all-X segment cannot masquerade as one.
 */
const MODULE_TOKENS = ALL_LICENSE_PREFIXES.map((prefix) => prefix.split("-")[1]);
const PLACEHOLDER_SHAPE = new RegExp(`^OMNIX-(?:${MODULE_TOKENS.join("|")})(?:-X{4}){3}$`);

function placeholdersIn(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const literal = [...source.matchAll(/placeholder="(OMNIX[^"]*)"/g)].map((m) => m[1]);
  const templated = [...source.matchAll(/placeholder=\{`\$\{LICENSE_PREFIX\}([^`]*)`\}/g)].map(
    // Resolve the template against every variant this binary can be built as.
    (m) => m[1],
  );
  return [
    ...literal,
    ...templated.flatMap((suffix) => VARIANTS.map((v) => `${variantLicensePrefix(v)}${suffix}`)),
  ];
}

describe("licence key placeholders", () => {
  it("finds a placeholder in every key entry screen", () => {
    for (const file of KEY_INPUTS) {
      expect(placeholdersIn(file).length, file).toBeGreaterThan(0);
    }
  });

  it("shows the real five-segment shape including the module segment", () => {
    for (const file of KEY_INPUTS) {
      for (const placeholder of placeholdersIn(file)) {
        expect(placeholder, `${file}: ${placeholder}`).toMatch(PLACEHOLDER_SHAPE);
        expect(placeholder.split("-"), `${file}: ${placeholder}`).toHaveLength(5);
      }
    }
  });

  it("uses a module segment the app actually issues", () => {
    const known = new Set(ALL_LICENSE_PREFIXES);
    for (const file of KEY_INPUTS) {
      for (const placeholder of placeholdersIn(file)) {
        const prefix = placeholder.split("-").slice(0, 2).join("-");
        expect(known.has(prefix as (typeof ALL_LICENSE_PREFIXES)[number]), `${file}: ${prefix}`).toBe(
          true,
        );
      }
    }
  });

  it("would be accepted by the validator once the X groups are filled in", () => {
    for (const file of KEY_INPUTS) {
      for (const placeholder of placeholdersIn(file)) {
        // Substitute the mask for characters from a real issued key.
        const filled = placeholder.replace(/X{4}/g, (_m, offset: number) =>
          ["822A", "B882", "4B60"][[...placeholder.matchAll(/X{4}/g)].findIndex((h) => h.index === offset)],
        );
        expect(isCompactKey(filled), `${file}: ${filled}`).toBe(true);
      }
    }
  });

  it("rejects the malformed placeholder that used to ship", () => {
    expect(PLACEHOLDER_SHAPE.test("OMNIX-XXXX-XXXX-XXXX-XXXX")).toBe(false);
  });
});
