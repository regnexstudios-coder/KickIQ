import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DetectError, parseFile } from "./index";
import { hashCustomer } from "./core/pii";

const ctx = { customerSalt: "test-salt" };
const fx = (n: string) => readFileSync(path.join(__dirname, "../../fixtures", n));

describe("Uber Eats — Order Errors", () => {
  it("parses deductions, logs bad rows instead of crashing", async () => {
    const r = await parseFile(fx("synthetic-ubereats-order-errors.csv"), ctx);
    expect(r.reportType).toBe("ubereats_order_errors");
    expect(r.deductions.map((d) => [d.externalOrderId, d.amount, d.reasonCode])).toEqual([
      ["UE-1001", 12.5, "missing_item"],
      ["UE-1002", 9.9, "wrong_item"],
      ["UE-1003", 1234.56, "quality"],
      ["UE-1007", 2.5, "missing_item"], // unreadable date keeps the deduction, date = null
    ]);
    expect(r.deductions[3]!.orderedAt).toBeNull();
    expect(r.unparsed.map((u) => u.row)).toEqual([5, 6]); // bad amount, blank order id
    expect(r.rowsSkipped).toBe(1); // zero-refund row
    expect(r.rowsRead).toBe(7);
  });

  it("keeps no customer PII, only a salted hash", async () => {
    const r = await parseFile(fx("synthetic-ubereats-order-errors.csv"), ctx);
    expect(r.deductions[0]!.customerHash).toBe(hashCustomer("test-salt", "cust-77"));
    expect(JSON.stringify(r)).not.toContain("cust-77");
  });

  it("parses items and reads a Spanish, semicolon file with title rows above the header", async () => {
    const r = await parseFile(fx("synthetic-ubereats-order-errors-es.csv"), ctx);
    expect(r.deductions).toHaveLength(2);
    expect(r.deductions[0]).toMatchObject({ externalOrderId: "UE-2001", amount: 18, reasonCode: "missing_item", items: [{ name: "Burger Doble", qty: 2 }] });
    expect(r.deductions[1]).toMatchObject({ reasonCode: "wrong_item", items: [{ name: "Pizza Cuatro Quesos", qty: 1 }] });
    expect(r.deductions[0]!.orderedAt).toBe("2026-10-03T11:05:00.000Z");
  });
});

describe("Uber Eats — Payment Details", () => {
  it("emits orders and recovery credits, skips fee lines", async () => {
    const r = await parseFile(fx("synthetic-ubereats-payment-details.csv"), ctx);
    expect(r.reportType).toBe("ubereats_payment_details");
    expect(r.payoutCredits).toEqual([expect.objectContaining({ externalOrderId: "UE-1001", amount: 12.5 })]);
    expect(r.orders.map((o) => [o.externalOrderId, o.grossAmount])).toEqual([["UE-1001", 40], ["UE-1002", 25]]);
    expect(r.rowsSkipped).toBe(1);
  });
});

describe("Uber Eats — Order History", () => {
  it("parses orders with pickup time", async () => {
    const r = await parseFile(fx("synthetic-ubereats-order-history.csv"), ctx);
    expect(r.reportType).toBe("ubereats_order_history");
    expect(r.orders[0]).toMatchObject({ externalOrderId: "UE-1001", grossAmount: 40, courierPickupAt: "2026-10-03T11:22:00.000Z" });
    expect(r.orders[0]!.items).toHaveLength(2);
  });
});

describe("Glovo", () => {
  it("parses orders (thousands separator, spaced quantities)", async () => {
    const r = await parseFile(fx("synthetic-glovo-orders.csv"), ctx);
    expect(r.reportType).toBe("glovo_orders");
    expect(r.orders.map((o) => o.grossAmount)).toEqual([32.4, 1020]);
    expect(r.orders[0]!.items).toEqual([{ name: "Ramen", qty: 1 }, { name: "Gyozas", qty: 2 }]);
  });

  it("splits payout lines into deductions / credits / skipped, and logs unreferenced deductions", async () => {
    const r = await parseFile(fx("synthetic-glovo-payout.csv"), ctx);
    expect(r.reportType).toBe("glovo_payout");
    expect(r.deductions.map((d) => [d.externalOrderId, d.amount])).toEqual([["GL-5001", 14.8], ["GL-5002", 6]]);
    expect(r.payoutCredits).toEqual([expect.objectContaining({ externalOrderId: "GL-5001", amount: 14.8 })]);
    expect(r.unparsed).toHaveLength(1);
    expect(r.rowsSkipped).toBe(2); // sale line + commission
  });
});

describe("detection", () => {
  it("rejects unknown files with a helpful error", async () => {
    await expect(parseFile(Buffer.from("foo,bar\n1,2\n"), ctx)).rejects.toThrow(DetectError);
  });
  it("can be forced and reports missing columns", async () => {
    await expect(parseFile(Buffer.from("foo,bar\n1,2\n"), ctx, "glovo_payout")).rejects.toThrow(/Missing required columns/);
  });
});
