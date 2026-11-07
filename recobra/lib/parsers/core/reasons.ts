import { normalizeHeader } from "./headers";
import type { ReasonCode } from "../types";

/** Deterministic first-pass classification of the platform's own wording. The AI layer refines it later. */
export function classifyReason(raw: string): ReasonCode {
  const t = normalizeHeader(raw);
  if (/(missing|falta|faltan|faltante|no incluido|not included|incomplet)/.test(t)) return "missing_item";
  if (/(wrong|incorrect|erroneo|equivocad|distinto|different|incorrecto)/.test(t)) return "wrong_item";
  if (/(quality|calidad|frio|cold|quemad|burnt|sabor|taste|aspecto|spill|derram)/.test(t)) return "quality";
  if (/(late|tarde|retras|delay|tardio)/.test(t)) return "late";
  if (/(cancel)/.test(t)) return "cancelled";
  return "other";
}

export function parseItems(input: string): { name: string; qty: number }[] {
  if (!input.trim()) return [];
  let chunks = input.split(/[;|\n]+/);
  if (chunks.length === 1 && /,\s*\d+\s*[x×]\s/i.test(input)) chunks = input.split(/,\s*(?=\d+\s*[x×]\s)/i);
  const items: { name: string; qty: number }[] = [];
  for (const c of chunks) {
    const s = c.trim();
    if (!s) continue;
    let m = /^(\d+)\s*[x×]\s*(.+)$/i.exec(s);
    if (m) { items.push({ name: m[2]!.trim(), qty: Number(m[1]) }); continue; }
    m = /^(.+?)\s*[x×]\s*(\d+)$/i.exec(s);
    if (m) { items.push({ name: m[1]!.trim(), qty: Number(m[2]) }); continue; }
    items.push({ name: s, qty: 1 });
  }
  return items;
}
