/**
 * Trial-lifecycle stage machine — pure-function tests. Verifies the
 * boundary conditions of the four-stage transition (active → grace →
 * read_only → expired) so we don't regress the shopkeeper-in-mid-shift
 * scenario that motivated v0.28.0.
 */
import { describe, it, expect } from "vitest";

const DAY = 24 * 60 * 60 * 1000;
const TRIAL_DAYS = 30;
const GRACE_DAYS = 7;
const READ_ONLY_DAYS = 23; // grace_days + read_only_days = 30 post-expiry

type Stage = "not_started" | "active" | "grace" | "read_only" | "expired";

function computeStage(startedAtMs: number, nowMs: number): { stage: Stage; daysLeft: number } {
  const expiresMs = startedAtMs + TRIAL_DAYS * DAY;
  const graceUntilMs = expiresMs + GRACE_DAYS * DAY;
  const readOnlyUntilMs = graceUntilMs + READ_ONLY_DAYS * DAY;

  if (nowMs < expiresMs) {
    return { stage: "active", daysLeft: Math.ceil((expiresMs - nowMs) / DAY) };
  }
  if (nowMs < graceUntilMs) {
    return { stage: "grace", daysLeft: Math.max(0, Math.ceil((graceUntilMs - nowMs) / DAY)) };
  }
  if (nowMs < readOnlyUntilMs) {
    return { stage: "read_only", daysLeft: Math.max(0, Math.ceil((readOnlyUntilMs - nowMs) / DAY)) };
  }
  return { stage: "expired", daysLeft: 0 };
}

describe("trial lifecycle stages", () => {
  const start = new Date("2026-01-01T00:00:00Z").getTime();

  it("Day 0 → active", () => {
    expect(computeStage(start, start).stage).toBe("active");
  });

  it("Day 15 → active", () => {
    expect(computeStage(start, start + 15 * DAY).stage).toBe("active");
  });

  it("Day 29.9 → active (last hours)", () => {
    expect(computeStage(start, start + 29.9 * DAY).stage).toBe("active");
  });

  it("Day 30 (moment of expiry) → grace", () => {
    // Trial expires at exactly start + 30 days. The comparison is strict
    // less-than, so at t = start + 30d we've entered grace.
    expect(computeStage(start, start + TRIAL_DAYS * DAY).stage).toBe("grace");
  });

  it("Day 31 → grace with ~6 days left", () => {
    const r = computeStage(start, start + 31 * DAY);
    expect(r.stage).toBe("grace");
    expect(r.daysLeft).toBeGreaterThanOrEqual(6);
    expect(r.daysLeft).toBeLessThanOrEqual(7);
  });

  it("Day 36.9 → still grace (last minutes of grace)", () => {
    expect(computeStage(start, start + 36.9 * DAY).stage).toBe("grace");
  });

  it("Day 37 (grace ended) → read_only", () => {
    expect(computeStage(start, start + 37 * DAY).stage).toBe("read_only");
  });

  it("Day 40 → read_only with ~20 days left", () => {
    const r = computeStage(start, start + 40 * DAY);
    expect(r.stage).toBe("read_only");
    expect(r.daysLeft).toBeGreaterThanOrEqual(20);
    expect(r.daysLeft).toBeLessThanOrEqual(21);
  });

  it("Day 59.9 → still read_only", () => {
    expect(computeStage(start, start + 59.9 * DAY).stage).toBe("read_only");
  });

  it("Day 60 (30 days post-expiry) → expired", () => {
    expect(computeStage(start, start + 60 * DAY).stage).toBe("expired");
  });

  it("Day 90 → expired", () => {
    expect(computeStage(start, start + 90 * DAY).stage).toBe("expired");
  });

  it("Grace + read_only add up to exactly 30 days post-expiry", () => {
    expect(GRACE_DAYS + READ_ONLY_DAYS).toBe(30);
  });
});
