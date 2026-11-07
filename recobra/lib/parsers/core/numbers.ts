/**
 * Parse a money string in either European (1.234,56) or English (1,234.56 / 1234.56) style.
 * Handles currency symbols, spaces, "-" prefix, trailing "-", and (parentheses) negatives.
 * Returns null when the value is empty or not a number.
 */
export function parseAmount(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? round2(input) : null;
  if (input == null) return null;
  let s = String(input).trim();
  if (!s || s === "-" || s === "—") return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[\s €$£]|EUR|eur/g, "");
  if (s.startsWith("-") || s.startsWith("−")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.endsWith("-")) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (s.startsWith("+")) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let decimalSep: "," | "." | null = null;

  if (lastComma >= 0 && lastDot >= 0) {
    decimalSep = lastComma > lastDot ? "," : ".";
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? "," : ".";
    const parts = s.split(sep);
    // Single separator: decimal if exactly 1-2 digits follow and it appears once;
    // "1.234" / "1,234" (3 digits) is a thousands separator.
    const tail = parts[parts.length - 1] ?? "";
    if (parts.length === 2 && tail.length !== 3) decimalSep = sep;
    else if (parts.length === 2 && tail.length === 3 && (parts[0] ?? "") === "0") decimalSep = sep;
    else decimalSep = null;
  }

  let normalized: string;
  if (decimalSep) {
    const thousands = decimalSep === "," ? /\./g : /,/g;
    normalized = s.replace(thousands, "").replace(decimalSep, ".");
  } else {
    normalized = s.replace(/[.,]/g, "");
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return round2(negative ? -n : n);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
