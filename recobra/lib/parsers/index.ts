import { readTable } from "./core/readTable";
import { glovoOrders, glovoPayout } from "./glovo";
import { ubereatsOrderErrors, ubereatsOrderHistory, ubereatsPaymentDetails } from "./ubereats";
import type { ParseContext, ParseResult, Parser, ReportType } from "./types";

export const parsers: Parser[] = [
  ubereatsOrderErrors,
  ubereatsPaymentDetails,
  ubereatsOrderHistory,
  glovoOrders,
  glovoPayout,
];

export class DetectError extends Error {}

/** Pick the parser for a file; pass `reportType` to force one. */
export async function parseFile(buf: Buffer, ctx: ParseContext, reportType?: ReportType): Promise<ParseResult> {
  const sheets = await readTable(buf);
  if (reportType) {
    const p = parsers.find((x) => x.reportType === reportType);
    if (!p) throw new DetectError(`No parser for report type "${reportType}" (Just Eat arrives in Phase 4)`);
    return p.parse(sheets, ctx);
  }
  const scored = parsers.map((p) => ({ p, s: p.detect(sheets) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  if (scored.length === 0) throw new DetectError("Could not recognise this file as any supported report. Pass --type explicitly.");
  if (scored.length > 1 && scored[0]!.s === scored[1]!.s) {
    throw new DetectError(`Ambiguous report: could be ${scored.filter((x) => x.s === scored[0]!.s).map((x) => x.p.reportType).join(" or ")}. Pass --type.`);
  }
  return scored[0]!.p.parse(sheets, ctx);
}
