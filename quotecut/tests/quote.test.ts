import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { computePricing } from "../lib/quote";
import { checkoutUrl, planForStatus, verifySignature } from "../lib/billing";
import { DEFAULT_RATES, type Rates } from "../lib/types";

const rates: Rates = { short_form: 50, long_form: 150, thumbnail: 25, rush_multiplier: 1.3, min_budget: 100 };

describe("computePricing", () => {
  it("prices a single service from the editor's rate", () => {
    const p = computePricing({ items: [{ service: "short_form", quantity: 8 }], is_rush: false, complexity: 1 }, rates);
    expect(p.subtotal).toBe(400);
    expect([p.estimated_min, p.estimated_max]).toEqual([360, 480]);
    expect(p.service_type).toBe("short_form");
  });

  it("never drops below the minimum budget", () => {
    const p = computePricing({ items: [{ service: "thumbnail", quantity: 1 }], is_rush: false, complexity: 0.8 }, rates);
    expect(p.estimated_min).toBe(100);
    expect(p.estimated_max).toBeGreaterThanOrEqual(100);
  });

  it("applies the rush multiplier only when rush", () => {
    const base = computePricing({ items: [{ service: "long_form", quantity: 2 }], is_rush: false, complexity: 1 }, rates);
    const rush = computePricing({ items: [{ service: "long_form", quantity: 2 }], is_rush: true, complexity: 1 }, rates);
    expect(rush.estimated_max).toBe(Math.round((base.subtotal * 1.2 * 1.3) / 5) * 5);
    expect(rush.estimated_max).toBeGreaterThan(base.estimated_max);
  });

  it("treats mixed services as a bundle and merges duplicates", () => {
    const p = computePricing(
      { items: [{ service: "short_form", quantity: 2 }, { service: "short_form", quantity: 2 }, { service: "thumbnail", quantity: 4 }], is_rush: false, complexity: 1 },
      rates
    );
    expect(p.service_type).toBe("bundle");
    expect(p.quantity).toBe(8);
    expect(p.items.find((i) => i.service === "short_form")?.quantity).toBe(4);
  });

  it("clamps hostile AI output (complexity, quantity)", () => {
    const p = computePricing({ items: [{ service: "short_form", quantity: 99999 }], is_rush: false, complexity: 50 }, rates);
    expect(p.complexity).toBe(1.5);
    expect(p.quantity).toBe(500);
  });

  it("falls back to one item when AI returns none", () => {
    const p = computePricing({ items: [], is_rush: false, complexity: 1 }, DEFAULT_RATES);
    expect(p.quantity).toBe(1);
  });
});

describe("billing", () => {
  it("verifies Lemon Squeezy signatures", () => {
    const body = '{"a":1}';
    const sig = createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(verifySignature(body, sig, "s3cret")).toBe(true);
    expect(verifySignature(body, sig, "other")).toBe(false);
    expect(verifySignature(body, null, "s3cret")).toBe(false);
    expect(verifySignature(body, "short", "s3cret")).toBe(false);
  });

  it("maps subscription status to plan", () => {
    expect(planForStatus("active")).toBe("pro");
    expect(planForStatus("expired")).toBe("free");
    expect(planForStatus("cancelled")).toBeNull();
  });

  it("attaches user id to checkout", () => {
    const u = checkoutUrl("https://x.lemonsqueezy.com/buy/abc", "uid-1", "a@b.com");
    expect(u).toContain("checkout%5Bcustom%5D%5Buser_id%5D=uid-1");
  });
});
