import type { ParsedCredit, ParsedOrder, Platform } from "@/lib/parsers/types";
import type { ClientInfo, DeductionRow, ImportRecord, ImportStore, StoredOrder } from "./store";

/** In-memory ImportStore that enforces the same unique keys as the SQL schema. Used by tests. */
export class MemoryStore implements ImportStore {
  orders = new Map<string, StoredOrder>(); // key: account|externalId
  deductions = new Map<string, DeductionRow>();
  credits = new Map<string, ParsedCredit>();
  imports: (ImportRecord & { id: string })[] = [];
  private n = 0;
  constructor(private client: ClientInfo) {}

  async getClient() { return this.client; }
  async findImportBySha(_c: string, sha: string) { return this.imports.find((i) => i.fileSha256 === sha) ?? null; }
  async ensurePlatformAccount(_c: string, p: Platform) { return `acct-${p}`; }
  async createImport(rec: ImportRecord) { const id = `imp-${++this.n}`; this.imports.push({ ...rec, id }); return id; }
  async getOrders(acct: string, ids: string[]) {
    return ids.map((i) => this.orders.get(`${acct}|${i}`)).filter((o): o is StoredOrder => !!o);
  }
  async upsertOrders(acct: string, orders: ParsedOrder[]) {
    const out = new Map<string, string>();
    for (const o of orders) {
      const key = `${acct}|${o.externalOrderId}`;
      const id = this.orders.get(key)?.id ?? `ord-${++this.n}`;
      this.orders.set(key, { ...o, id });
      out.set(o.externalOrderId, id);
    }
    return out;
  }
  async insertDeductions(rows: DeductionRow[]) {
    let added = 0;
    for (const r of rows) {
      const key = [r.orderId, r.platform, r.reasonRaw, r.amount, r.deductedAt].join("|");
      if (!this.deductions.has(key)) { this.deductions.set(key, r); added++; }
    }
    return added;
  }
  async insertCredits(clientId: string, _imp: string, credits: ParsedCredit[]) {
    let added = 0;
    for (const c of credits) {
      const key = [clientId, c.platform, c.externalOrderId, c.amount, c.creditedAt, c.descriptionRaw].join("|");
      if (!this.credits.has(key)) { this.credits.set(key, c); added++; }
    }
    return added;
  }
}
