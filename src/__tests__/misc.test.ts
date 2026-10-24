import { ageFromDob, daysBetween, isoWeekKey } from '@/lib/date';
import { evaluateRedeem, generateReferralCode, isValidCodeFormat, normaliseCode } from '@/features/referral/referral';
import { decodeMoveNetOutput } from '@/features/pose/model';
import en from '@/i18n/en';
import es from '@/i18n/es';

describe('date helpers', () => {
  it('age gate math', () => {
    const now = new Date('2026-10-24');
    expect(ageFromDob(new Date('2013-10-24'), now)).toBe(13);
    expect(ageFromDob(new Date('2013-10-25'), now)).toBe(12);
  });
  it('days between and week keys', () => {
    expect(daysBetween(new Date('2026-10-01'), new Date('2026-10-04'))).toBe(3);
    expect(isoWeekKey(new Date('2026-10-24'))).toBe('2026-W43');
    expect(isoWeekKey(new Date('2026-01-01'))).toBe('2026-W01');
  });
});

describe('referral codes', () => {
  it('generates valid, deterministic codes', () => {
    const c = generateReferralCode('user-1');
    expect(isValidCodeFormat(c)).toBe(true);
    expect(generateReferralCode('user-1')).toBe(c);
    expect(generateReferralCode('user-2')).not.toBe(c);
  });
  it('normalises ambiguous characters', () => {
    expect(normaliseCode('ab-cd 0o')).toBe('ABCD00');
  });
  it('evaluates redemption rules', () => {
    const own = generateReferralCode('me');
    expect(evaluateRedeem(own, own, null)).toBe('own');
    expect(evaluateRedeem('bad', own, null)).toBe('invalid');
    expect(evaluateRedeem(generateReferralCode('friend'), own, 'ABCDEF')).toBe('already');
    expect(evaluateRedeem(generateReferralCode('friend'), own, null)).toBe('ok');
  });
});

describe('MoveNet decode', () => {
  it('maps y,x,score triplets', () => {
    const buf = new Float32Array(51);
    buf[0] = 0.1; buf[1] = 0.2; buf[2] = 0.9;
    const kp = decodeMoveNetOutput(buf);
    expect(kp).toHaveLength(17);
    expect(kp[0]!.y).toBeCloseTo(0.1);
    expect(kp[0]!.x).toBeCloseTo(0.2);
    expect(kp[0]!.score).toBeCloseTo(0.9);
  });
});

describe('i18n', () => {
  function keys(obj: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' && !Array.isArray(v) ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    );
  }
  it('every Spanish key exists in English', () => {
    const enKeys = new Set(keys(en));
    for (const k of keys(es)) expect(enKeys.has(k)).toBe(true);
  });
  it('English has no empty strings', () => {
    const walk = (o: unknown): void => {
      if (typeof o === 'string') expect(o.length).toBeGreaterThan(0);
      else if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') Object.values(o).forEach(walk);
    };
    walk(en);
  });
});
