/** Small, dependency-free unique id (time-sortable prefix + random suffix). */
export function newId(prefix = 'a'): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${t}${r}`;
}
