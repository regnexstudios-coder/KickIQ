import { useEffect, useRef, useState } from 'react';

/** Eases a number from `from` to `to` over `durationMs`. Re-runs when `to` changes. */
export function useCountUp(to: number, durationMs = 1200, from = 0): number {
  const [value, setValue] = useState(from);
  const start = useRef<number | null>(null);
  const fromRef = useRef(from);

  useEffect(() => {
    let raf: ReturnType<typeof requestAnimationFrame>;
    start.current = null;
    const begin = fromRef.current;
    const tick = (now: number) => {
      if (start.current == null) start.current = now;
      const p = Math.min(1, (now - start.current) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = begin + (to - begin) * eased;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs]);

  return value;
}
