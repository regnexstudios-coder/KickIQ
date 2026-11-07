import { findHeaderRow, HeaderError, matchColumns, type TableSpec } from "./headers";
import type { Cell, Sheet } from "./readTable";
import { parseResultSchema, type ParseResult, type ParseContext, type Parser, type Platform, type ReportType } from "../types";

export type Row<K extends string> = {
  /** Raw cell for a field, or null. */
  raw(field: K): Cell;
  /** Trimmed string for a field, or "" */
  str(field: K): string;
};

export type RowOutput = Partial<Pick<ParseResult, "orders" | "deductions" | "payoutCredits">> & {
  /** Row was understood but intentionally produces nothing. */
  skip?: boolean;
  /** Row is bad: reported in `unparsed` instead of throwing. */
  error?: string;
};

export interface TableParserDef<K extends string> {
  reportType: ReportType;
  platform: Platform;
  spec: TableSpec<K>;
  mapRow(row: Row<K>, ctx: ParseContext): RowOutput;
}

const isBlank = (r: Cell[]) => r.every((c) => c == null || String(c).trim() === "");

export function defineTableParser<K extends string>(def: TableParserDef<K>): Parser {
  const locate = (sheets: Sheet[]) => {
    for (const sheet of sheets) {
      const found = findHeaderRow(sheet.rows, def.spec);
      if (found) return { sheet, ...found };
    }
    return null;
  };

  return {
    reportType: def.reportType,
    platform: def.platform,

    detect(sheets) {
      const f = locate(sheets);
      return f ? f.match.matched : 0;
    },

    parse(sheets, ctx) {
      const found = locate(sheets);
      if (!found) {
        // Produce a useful error: which required columns are missing in the best candidate.
        const first = sheets[0]?.rows.slice(0, 5) ?? [];
        const best = first.map((r) => matchColumns(r, def.spec)).sort((a, b) => b.matched - a.matched)[0];
        throw new HeaderError(
          `No header row found for ${def.reportType}. Missing required columns: ${(best?.missingRequired ?? Object.keys(def.spec)).join(", ")}`,
          (best?.missingRequired ?? []) as string[],
          (first[0] ?? []).map(String),
        );
      }
      const { sheet, index, match } = found;
      const out: ParseResult = {
        reportType: def.reportType,
        orders: [],
        deductions: [],
        payoutCredits: [],
        unparsed: [],
        rowsRead: 0,
        rowsSkipped: 0,
        periodStart: null,
        periodEnd: null,
      };

      for (let i = index + 1; i < sheet.rows.length; i++) {
        const cells = sheet.rows[i]!;
        if (isBlank(cells)) continue;
        out.rowsRead++;
        const rowNumber = i + 1; // 1-based, as seen in Excel
        const row: Row<K> = {
          raw: (f) => {
            const col = match.columns[f];
            return col === undefined ? null : (cells[col] ?? null);
          },
          str: (f) => {
            const col = match.columns[f];
            const v = col === undefined ? null : cells[col];
            return v == null ? "" : v instanceof Date ? v.toISOString() : String(v).trim();
          },
        };
        try {
          const r = def.mapRow(row, ctx);
          if (r.error) {
            out.unparsed.push({ row: rowNumber, reason: r.error, raw: cells.map((c) => String(c ?? "")) });
          } else if (r.skip) {
            out.rowsSkipped++;
          } else {
            if (r.orders) out.orders.push(...r.orders);
            if (r.deductions) out.deductions.push(...r.deductions);
            if (r.payoutCredits) out.payoutCredits.push(...r.payoutCredits);
          }
        } catch (e) {
          out.unparsed.push({
            row: rowNumber,
            reason: e instanceof Error ? e.message : "unknown error",
            raw: cells.map((c) => String(c ?? "")),
          });
        }
      }

      const dates = [
        ...out.orders.map((o) => o.orderedAt),
        ...out.deductions.map((d) => d.deductedAt ?? d.orderedAt),
        ...out.payoutCredits.map((c) => c.creditedAt),
      ].filter((d): d is string => !!d).sort();
      out.periodStart = dates[0] ?? null;
      out.periodEnd = dates[dates.length - 1] ?? null;

      return parseResultSchema.parse(out);
    },
  };
}
