import { describe, expect, it } from "vitest";
import {
  expiredPurchaseCopy,
  selectActivationNotice,
  variantPrice,
} from "@/services/license-status";
import type { Variant } from "@/lib/variant";

const UNUSED_TRIAL = { active: false, consumed: false, days_remaining: 30 };
const USED_TRIAL = { active: false, consumed: true, days_remaining: 0 };

describe("licence activation notice selection", () => {
  it.each(["cancelled", "lapsed", "expired"])(
    "shows the purchase state for a server-confirmed %s licence",
    (status) => {
      expect(
        selectActivationNotice({
          online: { kind: "confirmed", status, message: "trial ended or maintenance lapsed" },
          trial: UNUSED_TRIAL,
          hasStoredLicense: true,
        }),
      ).toEqual({ kind: "expired", source: "licence" });
    },
  );

  it("identifies a consumed local trial without a stored licence as a trial expiry", () => {
    expect(
      selectActivationNotice({
        online: { kind: "no-local-key" },
        trial: USED_TRIAL,
        hasStoredLicense: false,
      }),
    ).toEqual({ kind: "expired", source: "trial" });
  });

  it("keeps a locally running trial visible with its remaining days", () => {
    expect(
      selectActivationNotice({
        online: { kind: "no-local-key" },
        trial: { active: true, consumed: true, days_remaining: 12 },
        hasStoredLicense: false,
      }),
    ).toEqual({ kind: "trial-active", daysRemaining: 12 });
  });

  it("offers a trial only when no trial or licence has existed locally", () => {
    expect(
      selectActivationNotice({
        online: { kind: "no-local-key" },
        trial: UNUSED_TRIAL,
        hasStoredLicense: false,
      }),
    ).toEqual({ kind: "trial-offer" });
  });

  it("treats an unreachable server as unknown, never as an expiry", () => {
    expect(
      selectActivationNotice({
        online: { kind: "unreachable" },
        trial: USED_TRIAL,
        hasStoredLicense: true,
      }),
    ).toEqual({ kind: "unknown" });
  });

  it.each<Variant>(["dawa", "retail", "hospitality", "hardware", "salon", "pro"])(
    "uses perpetual-purchase copy and the configured price for a lapsed %s licence",
    (variant) => {
      const notice = selectActivationNotice({
        online: { kind: "confirmed", status: "lapsed", message: null },
        trial: USED_TRIAL,
        hasStoredLicense: true,
      });
      expect(notice).toEqual({ kind: "expired", source: "licence" });
      if (notice.kind !== "expired") throw new Error("expected expired notice");

      const copy = expiredPurchaseCopy(notice.source, variantPrice(variant));
      expect(copy.title).toBe("Your licence has lapsed");
      expect(copy.action).toBe("Buy perpetual licence");
      expect(copy.description).toContain(variantPrice(variant));
      expect(copy.description).toContain("Purchase a perpetual licence");
    },
  );
});
