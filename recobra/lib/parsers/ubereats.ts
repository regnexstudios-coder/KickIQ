import { parseDate } from "./core/dates";
import { parseAmount } from "./core/numbers";
import { hashCustomer } from "./core/pii";
import { classifyReason, parseItems } from "./core/reasons";
import { defineTableParser } from "./core/tableParser";

const ORDER_ID = ["order id", "id de pedido", "id del pedido", "numero de pedido", "n de pedido", "order uuid", "id pedido"];
const DATE = ["order date", "fecha del pedido", "fecha de pedido", "fecha", "date"];
const ITEMS = ["items", "item", "articulos", "articulo", "productos", "producto", "item name", "nombre del articulo"];
const CUSTOMER = ["customer id", "id de cliente", "id cliente", "eater id"];

/** Uber Eats Manager — "Order Errors (Transaction)". One row per refunded item/error. */
export const ubereatsOrderErrors = defineTableParser({
  reportType: "ubereats_order_errors",
  platform: "ubereats",
  spec: {
    orderId: { synonyms: ORDER_ID, required: true },
    orderedAt: { synonyms: DATE },
    issue: { synonyms: ["error type", "issue type", "tipo de error", "tipo de incidencia", "motivo", "reason", "problema", "issue", "incidencia"], required: true },
    items: { synonyms: ITEMS },
    refund: { synonyms: ["refund amount", "importe reembolsado", "reembolso", "error amount", "importe del error", "refund", "importe de la incidencia"], required: true },
    customer: { synonyms: CUSTOMER },
  },
  mapRow(row, ctx) {
    const orderId = row.str("orderId");
    if (!orderId) return { error: "missing order id" };
    const amt = parseAmount(row.raw("refund"));
    if (amt == null) return { error: `unreadable refund amount "${row.str("refund")}"` };
    if (amt === 0) return { skip: true };
    const reasonRaw = row.str("issue");
    const orderedAt = parseDate(row.raw("orderedAt"));
    const cust = row.str("customer");
    return {
      deductions: [{
        platform: "ubereats",
        externalOrderId: orderId,
        amount: Math.abs(amt),
        currency: "EUR",
        reasonRaw,
        reasonCode: classifyReason(reasonRaw),
        // Uber's dispute window runs from the order date, so that's the deduction anchor too.
        deductedAt: orderedAt,
        orderedAt,
        items: parseItems(row.str("items")),
        customerHash: cust ? hashCustomer(ctx.customerSalt, cust) : null,
      }],
    };
  },
});

/** Uber Eats — "Payment Details". Gives gross sales per order and the credits that prove a recovery. */
export const ubereatsPaymentDetails = defineTableParser({
  reportType: "ubereats_payment_details",
  platform: "ubereats",
  spec: {
    orderId: { synonyms: ORDER_ID, required: true },
    date: { synonyms: ["payout date", "fecha de pago", "fecha del pago", "transaction date", "fecha de la transaccion", ...DATE] },
    type: { synonyms: ["transaction type", "tipo de transaccion", "tipo", "type", "description", "descripcion", "concepto"], required: true },
    amount: { synonyms: ["total payout", "pago total", "net amount", "importe neto", "total", "amount", "importe"], required: true },
    sales: { synonyms: ["sales", "ventas", "gross sales", "ventas brutas"] },
  },
  mapRow(row) {
    const type = row.str("type");
    const amt = parseAmount(row.raw("amount"));
    if (amt == null) return { error: `unreadable amount "${row.str("amount")}"` };
    const orderId = row.str("orderId");
    const date = parseDate(row.raw("date"));
    const t = type.toLowerCase();
    // Positive adjustment/refund lines are the money coming back.
    if (amt > 0 && /(adjust|ajuste|credit|abono|refund|reembolso|error|disput|reversal)/.test(t)) {
      return { payoutCredits: [{ platform: "ubereats", externalOrderId: orderId || null, amount: amt, creditedAt: date, descriptionRaw: type }] };
    }
    const sales = parseAmount(row.raw("sales"));
    if (orderId && sales != null && sales > 0) {
      return { orders: [{ platform: "ubereats", externalOrderId: orderId, orderedAt: date, grossAmount: sales, items: [], courierPickupAt: null, status: null, customerHash: null }] };
    }
    return { skip: true };
  },
});

/** Uber Eats — order history export. */
export const ubereatsOrderHistory = defineTableParser({
  reportType: "ubereats_order_history",
  platform: "ubereats",
  spec: {
    orderId: { synonyms: ORDER_ID, required: true },
    orderedAt: { synonyms: DATE, required: true },
    subtotal: { synonyms: ["subtotal", "sales", "ventas", "gross sales", "ventas brutas", "total del pedido"], required: true },
    items: { synonyms: ITEMS },
    pickup: { synonyms: ["pickup time", "courier pickup", "hora de recogida", "recogida", "picked up at", "hora de recogida del repartidor"] },
    status: { synonyms: ["order status", "status", "estado", "estado del pedido"] },
    customer: { synonyms: CUSTOMER },
  },
  mapRow(row, ctx) {
    const orderId = row.str("orderId");
    if (!orderId) return { error: "missing order id" };
    const orderedAt = parseDate(row.raw("orderedAt"));
    if (!orderedAt) return { error: `unreadable date "${row.str("orderedAt")}"` };
    const cust = row.str("customer");
    return {
      orders: [{
        platform: "ubereats",
        externalOrderId: orderId,
        orderedAt,
        grossAmount: parseAmount(row.raw("subtotal")),
        items: parseItems(row.str("items")),
        courierPickupAt: parseDate(row.raw("pickup")),
        status: row.str("status") || null,
        customerHash: cust ? hashCustomer(ctx.customerSalt, cust) : null,
      }],
    };
  },
});
