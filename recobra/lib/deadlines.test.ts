import { describe, expect, it } from "vitest";
import { computeDeadline, deadlineState } from "./deadlines";

describe("computeDeadline", () => {
  const d = { orderedAt: "2026-10-01T10:00:00.000Z", deductedAt: "2026-10-10T10:00:00.000Z" };
  it("Uber Eats: 30 days from order date", () => expect(computeDeadline("ubereats", d)).toBe("2026-10-31T10:00:00.000Z"));
  it("Glovo: 30 days from deduction date", () => expect(computeDeadline("glovo", d)).toBe("2026-11-09T10:00:00.000Z"));
  it("Just Eat: 14 days default", () => expect(computeDeadline("justeat", d)).toBe("2026-10-24T10:00:00.000Z"));
  it("honours per-client overrides", () => expect(computeDeadline("glovo", d, { glovo: { days: 45 } })).toBe("2026-11-24T10:00:00.000Z"));
  it("falls back to the other date, then null", () => {
    expect(computeDeadline("glovo", { orderedAt: d.orderedAt, deductedAt: null })).toBe("2026-10-31T10:00:00.000Z");
    expect(computeDeadline("glovo", { orderedAt: null, deductedAt: null })).toBeNull();
  });
});

describe("deadlineState", () => {
  const now = new Date("2026-10-20T00:00:00.000Z");
  it.each([
    ["2026-10-19T00:00:00.000Z", "expired"], ["2026-10-22T12:00:00.000Z", "urgent"],
    ["2026-10-25T00:00:00.000Z", "soon"], ["2026-11-20T00:00:00.000Z", "ok"], [null, "unknown"],
  ])("%s -> %s", (iso, state) => expect(deadlineState(iso, now).state).toBe(state));
});
