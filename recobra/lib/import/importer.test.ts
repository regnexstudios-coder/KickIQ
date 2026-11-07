import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importFile } from "./importer";
import { MemoryStore } from "./memoryStore";

const fx = (n: string) => readFileSync(path.join(__dirname, "../../fixtures", n));
const mk = () => new MemoryStore({ id: "c1", name: "Test", customerSalt: "s", deadlineOverrides: {} });
const run = (s: MemoryStore, f: string) => importFile(s, { clientId: "c1", buffer: fx(f), fileName: f, importedBy: "test" });

describe("importFile", () => {
  it("loads deductions with deadlines and stub orders", async () => {
    const s = mk();
    const r = await run(s, "synthetic-ubereats-order-errors.csv");
    expect(r).toMatchObject({ duplicate: false, deductionsNew: 4, orders: 4 });
    const d = [...s.deductions.values()].find((x) => x.reasonRaw === "Missing Item" && x.amount === 12.5)!;
    expect(d.deadlineAt).toBe("2026-11-02T11:05:00.000Z"); // order 3 Oct 13:05 Madrid + 30d
  });

  it("is idempotent: same file twice is a no-op", async () => {
    const s = mk();
    await run(s, "synthetic-ubereats-order-errors.csv");
    const again = await run(s, "synthetic-ubereats-order-errors.csv");
    expect(again.duplicate).toBe(true);
    expect(s.deductions.size).toBe(4);
    expect(s.imports).toHaveLength(1);
  });

  it("merges order history into orders created from deductions, without losing data", async () => {
    const s = mk();
    await run(s, "synthetic-ubereats-order-errors.csv");
    await run(s, "synthetic-ubereats-order-history.csv");
    const o = s.orders.get("acct-ubereats|UE-1001")!;
    expect(o.grossAmount).toBe(40);
    expect(o.courierPickupAt).toBe("2026-10-03T11:22:00.000Z");
    expect(o.items.length).toBe(2);
    expect(s.deductions.size).toBe(4); // orders merged, deductions untouched
  });

  it("Glovo deadline counts from the deduction date; credits stored for later matching", async () => {
    const s = mk();
    await run(s, "synthetic-glovo-orders.csv");
    const r = await run(s, "synthetic-glovo-payout.csv");
    expect(r).toMatchObject({ deductionsNew: 2, creditsNew: 1 });
    const d = [...s.deductions.values()].find((x) => x.amount === 14.8)!;
    expect(d.deadlineAt).toBe("2026-11-07T22:00:00.000Z"); // 9 Oct 00:00 Madrid (UTC+2) + 30d
  });
});
