/** Referral codes: 6 chars from an unambiguous alphabet, e.g. "K7MX4Q". */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const REFERRAL_FREE_DAYS = 7;

export function generateReferralCode(seed?: string): string {
  let h = 2166136261;
  const s = seed ?? `${Date.now()}${Math.random()}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[h % ALPHABET.length];
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  }
  return out;
}

export function normaliseCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/I/g, '1').replace(/L/g, '1');
}

export function isValidCodeFormat(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code) && [...code].every((c) => ALPHABET.includes(c));
}

export type RedeemResult = 'ok' | 'invalid' | 'own' | 'already';

export function evaluateRedeem(input: string, ownCode: string | null, alreadyRedeemed: string | null): RedeemResult {
  const code = normaliseCode(input);
  if (!isValidCodeFormat(code)) return 'invalid';
  if (alreadyRedeemed) return 'already';
  if (ownCode && code === ownCode) return 'own';
  return 'ok';
}
