import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedCredit, ParsedOrder, Platform } from "@/lib/parsers/types";
import type { ClientInfo, DeductionRow, ImportRecord, ImportStore, StoredOrder } from "./store";

type Res<T> = { data: T; error: { message: string } | null };

/** Throws on error or when no data came back. */
function check<T>(res: Res<T>, what: string): NonNullable<T> {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  if (res.data == null) throw new Error(`${what}: no data returned`);
  return res.data;
}

/** For maybeSingle(): null is a legitimate answer. */
function checkMaybe<T>(res: Res<T>, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

/** ImportStore backed by Supabase. Needs a service-role client (bypasses RLS) — server/CLI only. */
export class SupabaseStore implements ImportStore {
  constructor(private db: SupabaseClient) {}

  async getClient(clientId: string): Promise<ClientInfo> {
    const c = check(await this.db.from("clients").select("id,name,deadline_overrides").eq("id", clientId).single(), "load client");
    const s = checkMaybe(await this.db.from("client_secrets").select("customer_salt").eq("client_id", clientId).maybeSingle(), "load salt");
    let salt = s?.customer_salt as string | undefined;
    if (!salt) {
      check(await this.db.from("client_secrets").insert({ client_id: clientId }), "create salt");
      salt = check(await this.db.from("client_secrets").select("customer_salt").eq("client_id", clientId).single(), "reload salt").customer_salt;
    }
    return { id: c.id, name: c.name, customerSalt: salt!, deadlineOverrides: c.deadline_overrides ?? {} };
  }

  async findImportBySha(clientId: string, sha: string) {
    return checkMaybe(await this.db.from("imports").select("id").eq("client_id", clientId).eq("file_sha256", sha).maybeSingle(), "find import");
  }

  async ensurePlatformAccount(clientId: string, platform: Platform): Promise<string> {
    let loc = checkMaybe(await this.db.from("locations").select("id").eq("client_id", clientId).order("name").limit(1).maybeSingle(), "find location");
    if (!loc) loc = check(await this.db.from("locations").insert({ client_id: clientId, name: "Principal" }).select("id").single(), "create location");
    const found = checkMaybe(await this.db.from("platform_accounts").select("id").eq("location_id", loc!.id).eq("platform", platform).maybeSingle(), "find account");
    if (found) return found.id;
    return check(await this.db.from("platform_accounts").insert({ location_id: loc!.id, platform }).select("id").single(), "create account").id;
  }

  async createImport(r: ImportRecord): Promise<string> {
    return check(await this.db.from("imports").insert({
      client_id: r.clientId, platform: r.platform, file_path: r.filePath, file_sha256: r.fileSha256, report_type: r.reportType,
      period_start: r.periodStart, period_end: r.periodEnd, rows_parsed: r.rowsParsed, rows_skipped: r.rowsSkipped,
      unparsed: r.unparsed, imported_by: r.importedBy,
    }).select("id").single(), "create import").id;
  }

  async getOrders(accountId: string, ids: string[]): Promise<StoredOrder[]> {
    const out: StoredOrder[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const rows = check(await this.db.from("orders").select("*").eq("platform_account_id", accountId).in("external_order_id", ids.slice(i, i + 200)), "load orders");
      for (const r of rows) out.push({
        id: r.id, externalOrderId: r.external_order_id, orderedAt: r.ordered_at, grossAmount: r.gross_amount === null ? null : Number(r.gross_amount),
        items: r.items, courierPickupAt: r.courier_pickup_at, status: r.status, customerHash: r.customer_hash,
      });
    }
    return out;
  }

  async upsertOrders(accountId: string, orders: ParsedOrder[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    for (let i = 0; i < orders.length; i += 500) {
      const rows = check(await this.db.from("orders").upsert(
        orders.slice(i, i + 500).map((o) => ({
          platform_account_id: accountId, external_order_id: o.externalOrderId, ordered_at: o.orderedAt, gross_amount: o.grossAmount,
          items: o.items, courier_pickup_at: o.courierPickupAt, status: o.status, customer_hash: o.customerHash,
        })),
        { onConflict: "platform_account_id,external_order_id" },
      ).select("id,external_order_id"), "upsert orders");
      for (const r of rows) out.set(r.external_order_id, r.id);
    }
    return out;
  }

  async insertDeductions(rows: DeductionRow[]): Promise<number> {
    let added = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const res = check(await this.db.from("deductions").upsert(
        rows.slice(i, i + 500).map((r) => ({
          order_id: r.orderId, platform: r.platform, amount: r.amount, reason_raw: r.reasonRaw, reason_code: r.reasonCode,
          deducted_at: r.deductedAt, deadline_at: r.deadlineAt, source_import_id: r.sourceImportId,
        })),
        { onConflict: "order_id,platform,reason_raw,amount,deducted_at", ignoreDuplicates: true },
      ).select("id"), "insert deductions");
      added += res.length; // ignored duplicates are not returned
    }
    return added;
  }

  async insertCredits(clientId: string, importId: string, credits: ParsedCredit[]): Promise<number> {
    if (!credits.length) return 0;
    const res = check(await this.db.from("payout_credits").upsert(
      credits.map((c) => ({
        client_id: clientId, platform: c.platform, external_order_id: c.externalOrderId, amount: c.amount,
        credited_at: c.creditedAt, description_raw: c.descriptionRaw, import_id: importId,
      })),
      { onConflict: "client_id,platform,external_order_id,amount,credited_at,description_raw", ignoreDuplicates: true },
    ).select("id"), "insert credits");
    return res.length;
  }
}
