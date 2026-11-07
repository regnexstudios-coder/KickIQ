import { describe, expect, it } from "vitest";
import { parseAmount } from "./numbers";
import { parseDate } from "./dates";
import { matchColumns } from "./headers";
import { parseItems, classifyReason } from "./reasons";
import { hashCustomer } from "./pii";

describe("parseAmount", () => {
  it.each([
    ["1.234,56", 1234.56], ["1234.56", 1234.56], ["1,234.56", 1234.56], ["12,50", 12.5], ["9.90", 9.9],
    ["1.234", 1234], ["€ 7,00", 7], ["-14,80", -14.8], ["(3,00)", -3], ["3,00-", -3], ["0", 0], [12.345, 12.35],
  ])("%s -> %s", (i, o) => expect(parseAmount(i)).toBe(o));
  it.each(["", "-", "abc", null, undefined])("rejects %s", (i) => expect(parseAmount(i)).toBeNull());
});

describe("parseDate (Europe/Madrid)", () => {
  it("handles DST: summer is UTC+2, winter UTC+1", () => {
    expect(parseDate("2026-10-03 13:05:00")).toBe("2026-10-03T11:05:00.000Z");
    expect(parseDate("03/12/2026 13:05")).toBe("2026-12-03T12:05:00.000Z");
  });
  it("is day-first for numeric dates", () => expect(parseDate("04/10/2026")).toBe("2026-10-03T22:00:00.000Z"));
  it("keeps explicit offsets", () => expect(parseDate("2026-10-03T10:00:00Z")).toBe("2026-10-03T10:00:00.000Z"));
  it("parses Spanish month names", () => expect(parseDate("3 de octubre de 2026 14:05")).toBe("2026-10-03T12:05:00.000Z"));
  it("returns null for garbage", () => expect(parseDate("garbage-date")).toBeNull());
});

describe("matchColumns", () => {
  it("is accent/case/order insensitive and maps one column to one field", () => {
    const m = matchColumns(["Fecha", "IMPORTE", "Código de pedido"], {
      orderId: { synonyms: ["codigo de pedido"], required: true },
      date: { synonyms: ["fecha"] },
      amount: { synonyms: ["importe"], required: true },
    });
    expect(m.columns).toEqual({ orderId: 2, date: 0, amount: 1 });
    expect(m.missingRequired).toEqual([]);
  });
});

describe("reasons/items/pii", () => {
  it("classifies wording", () => {
    expect(classifyReason("Artículo faltante")).toBe("missing_item");
    expect(classifyReason("Wrong Item")).toBe("wrong_item");
    expect(classifyReason("Food Quality - cold")).toBe("quality");
  });
  it("parses items", () => {
    expect(parseItems("1x Burger; 2x Patatas")).toEqual([{ name: "Burger", qty: 1 }, { name: "Patatas", qty: 2 }]);
    expect(parseItems("Pizza x2")).toEqual([{ name: "Pizza", qty: 2 }]);
  });
  it("hashes customers per salt", () => {
    expect(hashCustomer("a", "C1")).toBe(hashCustomer("a", " c1 "));
    expect(hashCustomer("a", "c1")).not.toBe(hashCustomer("b", "c1"));
  });
});
