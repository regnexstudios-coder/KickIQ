import type { DeadlineOverrides } from "@/lib/deadlines";
import type { ParsedCredit, ParsedOrder, Platform } from "@/lib/parsers/types";

export interface ClientInfo {
  id: string;
  name: string;
  customerSalt: string;
  deadlineOverrides: DeadlineOverrides;
}

/** An order as persisted; the platform is implied by its platform account. */
export type StoredOrder = Omit<ParsedOrder, "platform"> & { id: string };

export interface DeductionRow {
  orderId: string;
  platform: Platform;
  amount: number;
  reasonRaw: string;
  reasonCode: string;
  deductedAt: string | null;
  deadlineAt: string | null;
  sourceImportId: string;
}

export interface ImportRecord {
  clientId: string;
  platform: Platform;
  filePath: string | null;
  fileSha256: string;
  reportType: string;
  periodStart: string | null;
  periodEnd: string | null;
  rowsParsed: number;
  rowsSkipped: number;
  unparsed: unknown[];
  importedBy: string;
}

/** Everything the importer needs from persistence. Implemented by Supabase and by an in-memory fake. */
export interface ImportStore {
  getClient(clientId: string): Promise<ClientInfo>;
  findImportBySha(clientId: string, sha: string): Promise<{ id: string } | null>;
  /** The platform account to attach orders to; created (with a default location) if absent. */
  ensurePlatformAccount(clientId: string, platform: Platform): Promise<string>;
  createImport(rec: ImportRecord): Promise<string>;
  getOrders(accountId: string, externalIds: string[]): Promise<StoredOrder[]>;
  /** Insert-or-replace by (account, external id). Returns external id -> row id. */
  upsertOrders(accountId: string, orders: ParsedOrder[]): Promise<Map<string, string>>;
  /** Insert, ignoring rows that already exist. Returns how many were new. */
  insertDeductions(rows: DeductionRow[]): Promise<number>;
  insertCredits(clientId: string, importId: string, credits: ParsedCredit[]): Promise<number>;
}
