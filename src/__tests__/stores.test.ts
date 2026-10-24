import { mockCoaching } from '@/features/analysis/mockCoach';
import { mockKickFrames } from '@/features/pose/mock';
import { computeMetrics } from '@/features/pose/metrics';
import { displayNameFor, kickForWeek, rankEntries } from '@/store/useChallengeStore';
import { bestByKick, previousOfType } from '@/store/useHistoryStore';
import { liveStreak, nextStreak } from '@/store/useStreakStore';
import { isEntitled } from '@/store/useSubscriptionStore';
import type { Analysis } from '@/features/analysis/types';

const a = (id: string, kickType: Analysis['kickType'], kickRating: number, createdAt: string): Analysis => ({
  id, userId: null, kickType, kickRating, subScores: { approach: 18, plant_foot: 18, contact: 18, follow_through: kickRating - 54 },
  oneFix: 'x', whyItMatters: 'y', drills: [], metrics: null, confidence: 0.8, videoUri: null, thumbnailUri: null, keyFrames: [],
  scoreCardUri: null, retakeOfId: null, source: 'camera', createdAt, synced: false,
});

describe('streaks', () => {
  const d = (s: string) => new Date(s);
  it('starts at 1, increments on consecutive days, resets after a gap', () => {
    let s = nextStreak({ current: 0, best: 0, lastActive: null }, d('2026-10-01T10:00:00Z'));
    expect(s.current).toBe(1);
    s = nextStreak(s, d('2026-10-01T20:00:00Z'));
    expect(s.current).toBe(1);
    s = nextStreak(s, d('2026-10-02T09:00:00Z'));
    expect(s.current).toBe(2);
    s = nextStreak(s, d('2026-10-05T09:00:00Z'));
    expect(s.current).toBe(1);
    expect(s.best).toBe(2);
  });
  it('a streak dies after a missed day', () => {
    const s = { current: 5, best: 5, lastActive: '2026-10-01T10:00:00Z' };
    expect(liveStreak(s, d('2026-10-02T10:00:00Z'))).toBe(5);
    expect(liveStreak(s, d('2026-10-04T10:00:00Z'))).toBe(0);
  });
});

describe('history selectors', () => {
  const list = [a('3', 'curler', 80, '2026-10-03'), a('2', 'driven', 60, '2026-10-02'), a('1', 'curler', 70, '2026-10-01')];
  it('best per kick', () => {
    const b = bestByKick(list);
    expect(b.curler?.id).toBe('3');
    expect(b.driven?.id).toBe('2');
    expect(b.chip).toBeUndefined();
  });
  it('previous of type skips self', () => {
    expect(previousOfType(list, 'curler', '3')?.id).toBe('1');
  });
});

describe('subscription', () => {
  it('promo expires', () => {
    expect(isEntitled({ status: 'promo', expiresAt: '2999-01-01' })).toBe(true);
    expect(isEntitled({ status: 'promo', expiresAt: '2000-01-01' })).toBe(false);
    expect(isEntitled({ status: 'none', expiresAt: null })).toBe(false);
    expect(isEntitled({ status: 'trial', expiresAt: null })).toBe(true);
  });
});

describe('weekly challenge', () => {
  it('display name is first name + initial only', () => {
    expect(displayNameFor('alex rodriguez smith')).toBe('Alex');
    expect(displayNameFor('alex', 'rodriguez')).toBe('Alex R.');
    expect(displayNameFor('')).toBe('Player');
  });
  it('ranks best score per player, top 10', () => {
    const e = (name: string, score: number, isMe = false) => ({ id: name + score, displayName: name, score, isMe, createdAt: '' });
    const r = rankEntries([e('A', 50), e('A', 70), e('B', 60), ...Array.from({ length: 12 }, (_, i) => e(`P${i}`, i))]);
    expect(r[0]?.displayName).toBe('A');
    expect(r[0]?.score).toBe(70);
    expect(r).toHaveLength(10);
  });
  it('rotates kick type by week', () => {
    expect(['driven', 'curler', 'knuckleball', 'chip']).toContain(kickForWeek('2026-W43'));
    expect(kickForWeek('2026-W01')).not.toBe(kickForWeek('2026-W02'));
  });
});

describe('mock coach', () => {
  it('returns a schema-consistent result from metrics', () => {
    const m = computeMetrics(mockKickFrames({ noise: 0 }));
    const r = mockCoaching('driven', m);
    const sum = r.sub_scores!.approach + r.sub_scores!.plant_foot + r.sub_scores!.contact + r.sub_scores!.follow_through;
    expect(r.kick_rating).toBe(sum);
    expect(r.drills).toHaveLength(3);
  });
});
