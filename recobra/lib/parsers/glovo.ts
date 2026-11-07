import { parseDate } from "./core/dates";
import { parseAmount } from "./core/numbers";
import { hashCustomer } from "./core/pii";
import { classifyReason, parseItems } from "./core/reasons";
import { defineTableParser } from "./core/tableParser";

/** Glovo Manager Portal — orders export. */
export const glovoOrders = defineTableParser({
  reportType: "glovo_orders",
  platform: "glovo",
  spec: {
    orderId: { synonyms: ["codigo de pedido", "codigo del pedido", "order code", "order id", "id pedido", "id de pedido", "n pedido", "numero de pedido"], required: true },
    orderedAt: { synonyms: ["fecha del pedido", "fecha de pedido", "fecha y hora", "order date", "fecha", "date"], required: true },
    total: { synonyms: ["importe total", "total pedido", "precio del pedido", "order total", "total", "precio"], required: true },
    items: { synonyms: ["productos", "producto", "products", "items", "articulos"] },
    pickup: { synonyms: ["hora de recogida", "recogida", "pickup time", "pickup", "recogido a las"] },
    status: { synonyms: ["estado", "status", "estado del pedido"] },
    customer: { synonyms: ["id de cliente", "id cliente", "customer id"] },
  },
  mapRow(row, ctx) {
    const orderId = row.str("orderId");
    if (!orderId) return { error: "missing order code" };
    const orderedAt = parseDate(row.raw("orderedAt"));
    if (!orderedAt) return { error: `unreadable date "${row.str("orderedAt")}"` };
    const cust = row.str("customer");
    return {
      orders: [{
        platform: "glovo",
        externalOrderId: orderId,
        orderedAt,
        grossAmount: parseAmount(row.raw("total")),
        items: parseItems(row.str("items")),
        courierPickupAt: parseDate(row.raw("pickup")),
        status: row.str("status") || null,
        customerHash: cust ? hashCustomer(ctx.customerSalt, cust) : null,
      }],
    };
  },
});

const DEDUCTION_RE = /(deduc|ajuste|incidencia|reclamaci|reembolso al cliente|refund|descuento por|penaliz)/;
const CREDIT_RE = /(abono|compensaci|devoluci|reembolso|recuper|credit|a favor|reversal|reversi)/;

/**
 * Glovo — payout / invoice statement. Deductions appear as "Pedido con deducción" or adjustment
 * lines (negative). Credits are positive lines referencing an order.
 */
export const glovoPayout = defineTableParser({
  reportType: "glovo_payout",
  platform: "glovo",
  spec: {
    concept: { synonyms: ["concepto", "descripcion", "concept", "description", "detalle"], required: true },
    orderId: { synonyms: ["codigo de pedido", "codigo del pedido", "order code", "order id", "pedido", "referencia", "reference", "id pedido"] },
    date: { synonyms: ["fecha", "date", "fecha del pedido", "fecha de pedido"] },
    amount: { synonyms: ["importe", "amount", "total", "importe neto", "cantidad"], required: true },
  },
  mapRow(row) {
    const concept = row.str("concept");
    const amt = parseAmount(row.raw("amount"));
    if (amt == null) return { error: `unreadable amount "${row.str("amount")}"` };
    if (amt === 0) return { skip: true };
    const t = concept.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const orderId = row.str("orderId");
    const date = parseDate(row.raw("date"));

    if (amt < 0 && DEDUCTION_RE.test(t)) {
      if (!orderId) return { error: "deduction line without an order reference" };
      return {
        deductions: [{
          platform: "glovo",
          externalOrderId: orderId,
          amount: Math.abs(amt),
          currency: "EUR",
          reasonRaw: concept,
          reasonCode: classifyReason(concept),
          deductedAt: date,
          orderedAt: null,
          items: [],
          customerHash: null,
        }],
      };
    }
    if (amt > 0 && CREDIT_RE.test(t)) {
      return { payoutCredits: [{ platform: "glovo", externalOrderId: orderId || null, amount: amt, creditedAt: date, descriptionRaw: concept }] };
    }
    return { skip: true };
  },
});
