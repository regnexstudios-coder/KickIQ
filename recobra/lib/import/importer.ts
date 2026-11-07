import { createHash } from "node:crypto";
import { computeDeadline } from "@/lib/deadlines";
import { parseFile } from "@/lib/parsers";
import type { ParsedOrder, Platform, ReportType, ParseResult } from "@/lib/parsers/types";
import type { ImportStore } from "./store";

export interface ImportOptions {
  clientId: string;
  buffer: Buffer;
  fileName: string;
  importedBy: string;
  reportType?: ReportType;
  /** Storage path if the raw file was uploaded (the CLI doesn't upload). */
  filePath?: string | null;
}

export interface ImportSummary {
  duplicate: boolean;
  importId: string | null;
  reportType: string;
  platform: Platform | null;
  rowsParsed: number;
  rowsSkipped: number;
  unparsed: ParseResult["unparsed"];
  orders: number;
  deductionsNew: number;
  deductionsSeen: number;
  creditsNew: number;
}

const platformOf = (rt: ReportType): Platform => (rt.startsWith("glovo") ? "glovo" : rt.startsWith("ubereats") ? "ubereats" : "justeat");

/** Keep whichever side has a value; the new file wins when both do. */
function mergeOrder(old: Omit<ParsedOrder, "platform"> | undefined, next: ParsedOrder): ParsedOrder {
  if (!old) return next;
  return {
    ...next,
    orderedAt: next.orderedAt ?? old.orderedAt,
    grossAmount: next.grossAmount ?? old.grossAmount,
    items: next.items.length ? next.items : old.items,
    courierPickupAt: next.courierPickupAt ?? old.courierPickupAt,
    status: next.status ?? old.status,
    customerHash: next.customerHash ?? old.customerHash,
  };
}

export async function importFile(store: ImportStore, opts: ImportOptions): Promise<ImportSummary> {
  const sha = createHash("sha256").update(opts.buffer).digest("hex");
  const client = await store.getClient(opts.clientId);

  const dup = await store.findImportBySha(opts.clientId, sha);
  const parsed = await parseFile(opts.buffer, { customerSalt: client.customerSalt }, opts.reportType);
  const platform = platformOf(parsed.reportType);
  const base = {
    reportType: parsed.reportType, platform, rowsParsed: parsed.rowsRead - parsed.unparsed.length - parsed.rowsSkipped,
    rowsSkipped: parsed.rowsSkipped, unparsed: parsed.unparsed,
  };
  if (dup) {
    return { ...base, duplicate: true, importId: dup.id, orders: 0, deductionsNew: 0, deductionsSeen: 0, creditsNew: 0 };
  }

  const accountId = await store.ensurePlatformAccount(opts.clientId, platform);
  const importId = await store.createImport({
    clientId: opts.clientId, platform, filePath: opts.filePath ?? null, fileSha256: sha, reportType: parsed.reportType,
    periodStart: parsed.periodStart, periodEnd: parsed.periodEnd, rowsParsed: base.rowsParsed,
    rowsSkipped: parsed.rowsSkipped, unparsed: parsed.unparsed, importedBy: opts.importedBy,
  });

  // Orders: the ones in the file, plus a stub for every deduction's order so the FK always resolves.
  const wanted = new Map<string, ParsedOrder>();
  for (const o of parsed.orders) wanted.set(o.externalOrderId, o);
  for (const d of parsed.deductions) {
    if (!wanted.has(d.externalOrderId)) {
      wanted.set(d.externalOrderId, {
        platform: d.platform, externalOrderId: d.externalOrderId, orderedAt: d.orderedAt, grossAmount: null,
        items: d.items, courierPickupAt: null, status: null, customerHash: d.customerHash,
      });
    } else {
      wanted.set(d.externalOrderId, mergeOrder(wanted.get(d.externalOrderId), {
        ...wanted.get(d.externalOrderId)!, orderedAt: d.orderedAt, items: d.items, customerHash: d.customerHash,
      }));
    }
  }
  const existing = new Map((await store.getOrders(accountId, [...wanted.keys()])).map((o) => [o.externalOrderId, o]));
  const merged = [...wanted.values()].map((o) => mergeOrder(existing.get(o.externalOrderId), o));
  const idByExternal = await store.upsertOrders(accountId, merged);
  const mergedById = new Map(merged.map((o) => [o.externalOrderId, o]));

  const rows = parsed.deductions.map((d) => {
    const order = mergedById.get(d.externalOrderId)!;
    return {
      orderId: idByExternal.get(d.externalOrderId)!,
      platform: d.platform,
      amount: d.amount,
      reasonRaw: d.reasonRaw,
      reasonCode: d.reasonCode,
      deductedAt: d.deductedAt,
      deadlineAt: computeDeadline(d.platform, { orderedAt: order.orderedAt, deductedAt: d.deductedAt }, client.deadlineOverrides),
      sourceImportId: importId,
    };
  });
  const deductionsNew = await store.insertDeductions(rows);
  const creditsNew = await store.insertCredits(opts.clientId, importId, parsed.payoutCredits);

  return { ...base, duplicate: false, importId, orders: merged.length, deductionsNew, deductionsSeen: rows.length - deductionsNew, creditsNew };
}
