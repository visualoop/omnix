import { describe, expect, it } from "vitest";
import { resolvePosFormFactor } from "@/components/pos/use-pos-form-factor";

describe("POS form-factor adapter", () => {
  it("uses the phone composition below 768px", () => {
    expect(resolvePosFormFactor(320)).toBe("phone");
    expect(resolvePosFormFactor(767)).toBe("phone");
  });

  it("uses the tablet composition from 768px through 1023px", () => {
    expect(resolvePosFormFactor(768)).toBe("tablet");
    expect(resolvePosFormFactor(1023)).toBe("tablet");
  });

  it("preserves desktop composition at 1024px and above", () => {
    expect(resolvePosFormFactor(1024)).toBe("desktop");
    expect(resolvePosFormFactor(1440)).toBe("desktop");
  });
});
