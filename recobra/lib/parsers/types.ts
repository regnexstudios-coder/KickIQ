import { z } from "zod";

export const platformSchema = z.enum(["glovo", "ubereats", "justeat"]);
export type Platform = z.infer<typeof platformSchema>;

export const reasonCodeSchema = z.enum(["missing_item", "wrong_item", "quality", "late", "cancelled", "other"]);
export type ReasonCode = z.infer<typeof reasonCodeSchema>;

export const reportTypeSchema = z.enum([
  "ubereats_order_errors",
  "ubereats_payment_details",
  "ubereats_order_history",
  "glovo_orders",
  "glovo_payout",
  "justeat_payout",
]);
export type ReportType = z.infer<typeof reportTypeSchema>;

const iso = z.string().datetime();

export const orderItemSchema = z.object({ name: z.string().min(1), qty: z.number().int().positive() });

/** No customer PII: only a salted hash of the platform's customer id (if the report has one). */
export const parsedOrderSchema = z.object({
  platform: platformSchema,
  externalOrderId: z.string().min(1),
  orderedAt: iso.nullable(),
  grossAmount: z.number().nullable(),
  items: z.array(orderItemSchema),
  courierPickupAt: iso.nullable(),
  status: z.string().nullable(),
  customerHash: z.string().nullable(),
});
export type ParsedOrder = z.infer<typeof parsedOrderSchema>;

export const parsedDeductionSchema = z.object({
  platform: platformSchema,
  externalOrderId: z.string().min(1),
  /** Positive number = money taken from the restaurant. */
  amount: z.number().positive(),
  currency: z.literal("EUR"),
  reasonRaw: z.string(),
  reasonCode: reasonCodeSchema,
  deductedAt: iso.nullable(),
  orderedAt: iso.nullable(),
  items: z.array(orderItemSchema),
  customerHash: z.string().nullable(),
});
export type ParsedDeduction = z.infer<typeof parsedDeductionSchema>;

export const parsedCreditSchema = z.object({
  platform: platformSchema,
  /** Order the credit refers to; null when the statement doesn't reference one. */
  externalOrderId: z.string().nullable(),
  amount: z.number().positive(),
  creditedAt: iso.nullable(),
  descriptionRaw: z.string(),
});
export type ParsedCredit = z.infer<typeof parsedCreditSchema>;

export const unparsedRowSchema = z.object({ row: z.number().int(), reason: z.string(), raw: z.array(z.string()) });
export type UnparsedRow = z.infer<typeof unparsedRowSchema>;

export const parseResultSchema = z.object({
  reportType: reportTypeSchema,
  orders: z.array(parsedOrderSchema),
  deductions: z.array(parsedDeductionSchema),
  payoutCredits: z.array(parsedCreditSchema),
  unparsed: z.array(unparsedRowSchema),
  rowsRead: z.number().int(),
  /** Rows deliberately ignored (e.g. normal sales lines in a payout statement). */
  rowsSkipped: z.number().int(),
  periodStart: iso.nullable(),
  periodEnd: iso.nullable(),
});
export type ParseResult = z.infer<typeof parseResultSchema>;

export interface ParseContext {
  /** Per-client secret used to hash customer ids. */
  customerSalt: string;
}

export interface Parser {
  reportType: ReportType;
  platform: Platform;
  /** >0 when this parser can read the sheets; higher = better match. */
  detect(sheets: import("./core/readTable").Sheet[]): number;
  parse(sheets: import("./core/readTable").Sheet[], ctx: ParseContext): ParseResult;
}
