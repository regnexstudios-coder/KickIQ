export const DEFAULT_TZ = "Europe/Madrid";

/** Offset (ms) of `tz` from UTC at the given UTC instant. */
function tzOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Convert wall-clock time in `tz` to a UTC Date. */
export function zonedToUtc(y: number, mo: number, d: number, h = 0, mi = 0, s = 0, tz = DEFAULT_TZ): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let utc = guess - tzOffsetMs(guess, tz);
  utc = guess - tzOffsetMs(utc, tz); // second pass handles DST edges
  return new Date(utc);
}

const MONTHS: Record<string, number> = {
  jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6, jul: 7, aug: 8, ago: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12, dic: 12,
};

/**
 * Parse the date formats seen in delivery-platform exports. Day-first is assumed for
 * numeric formats (Spain). Returns an ISO UTC string, or null if unrecognised.
 * Date-only values resolve to midnight local time.
 */
export function parseDate(input: unknown, tz = DEFAULT_TZ): string | null {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input.toISOString();
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;

  // ISO with explicit offset / Z → trust it.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const time = (str?: string) => {
    if (!str) return [0, 0, 0] as const;
    const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i.exec(str);
    if (!m) return [0, 0, 0] as const;
    let h = Number(m[1]);
    const ap = m[4]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return [h, Number(m[2]), Number(m[3] ?? 0)] as const;
  };

  // yyyy-mm-dd[ T]hh:mm[:ss]
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s,]+(.*))?$/.exec(s);
  if (m) return build(+m[1]!, +m[2]!, +m[3]!, time(m[4]), tz);

  // dd/mm/yyyy[ hh:mm[:ss]] (also - and .)
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[T\s,]+(.*))?$/.exec(s);
  if (m) {
    let y = +m[3]!;
    if (y < 100) y += 2000;
    return build(y, +m[2]!, +m[1]!, time(m[4]), tz);
  }

  // "3 oct 2025 14:05" / "3 de octubre de 2025"
  m = /^(\d{1,2})\s+(?:de\s+)?([A-Za-zÀ-ÿ]+)\.?\s+(?:de\s+)?(\d{4})(?:[,\s]+(.*))?$/.exec(s);
  if (m) {
    const key = m[2]!.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 3);
    const mo = MONTHS[key];
    if (mo) return build(+m[3]!, mo, +m[1]!, time(m[4]), tz);
  }
  return null;
}

function build(y: number, mo: number, d: number, t: readonly [number, number, number], tz: string): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = zonedToUtc(y, mo, d, t[0], t[1], t[2], tz);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
