/** Fuzzy header detection. Never relies on column positions. */

export function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface FieldSpec {
  /** Normalised synonyms (use normalizeHeader form: lowercase, no accents). */
  synonyms: string[];
  required?: boolean;
}
export type TableSpec<K extends string> = Record<K, FieldSpec>;

export class HeaderError extends Error {
  constructor(message: string, public missing: string[], public headers: string[]) {
    super(message);
    this.name = "HeaderError";
  }
}

/** 0 = no match, 3 = exact, 2 = header contains synonym (word-boundary), 1 = synonym contains header. */
function score(header: string, synonym: string): number {
  if (!header) return 0;
  if (header === synonym) return 3;
  if ((" " + header + " ").includes(" " + synonym + " ")) return 2;
  if (header.length >= 4 && synonym.includes(header)) return 1;
  return 0;
}

export interface ColumnMatch<K extends string> {
  columns: Partial<Record<K, number>>;
  /** Number of required fields matched / total required; and total fields matched. */
  matched: number;
  missingRequired: K[];
}

export function matchColumns<K extends string>(headers: unknown[], spec: TableSpec<K>): ColumnMatch<K> {
  const norm = headers.map(normalizeHeader);
  const used = new Set<number>();
  const columns: Partial<Record<K, number>> = {};
  const candidates: { field: K; idx: number; s: number }[] = [];
  for (const field of Object.keys(spec) as K[]) {
    norm.forEach((h, idx) => {
      let best = 0;
      for (const syn of spec[field].synonyms) best = Math.max(best, score(h, syn));
      if (best > 0) candidates.push({ field, idx, s: best });
    });
  }
  // Greedy by score, then by header order, so one column maps to at most one field.
  candidates.sort((a, b) => b.s - a.s || a.idx - b.idx);
  for (const c of candidates) {
    if (columns[c.field] !== undefined || used.has(c.idx)) continue;
    columns[c.field] = c.idx;
    used.add(c.idx);
  }
  const missingRequired = (Object.keys(spec) as K[]).filter((f) => spec[f].required && columns[f] === undefined);
  return { columns, matched: Object.keys(columns).length, missingRequired };
}

/** Find the header row within the first rows of a sheet (exports often have title rows). */
export function findHeaderRow<K extends string>(
  rows: unknown[][],
  spec: TableSpec<K>,
  maxScan = 25,
): { index: number; match: ColumnMatch<K> } | null {
  let best: { index: number; match: ColumnMatch<K> } | null = null;
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const match = matchColumns(rows[i] ?? [], spec);
    if (match.missingRequired.length > 0) continue;
    if (!best || match.matched > best.match.matched) best = { index: i, match };
  }
  return best;
}
