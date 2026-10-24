import { parseCoachingResult } from '@/features/analysis/schema';

const valid = {
  kick_type: 'curler',
  kick_rating: 72,
  sub_scores: { approach: 18, plant_foot: 14, contact: 20, follow_through: 20 },
  one_fix: 'Your plant foot is about 30 cm behind the ball, so you lean back and lift it. Plant level with the ball, pointing at the target.',
  why_it_matters: 'A closer plant foot keeps your knee over the ball and the shot down.',
  drills: [
    { name: 'Cone plant drill', how: 'Place a cone beside the ball; plant your foot touching it every rep.', reps: '3 x 10' },
    { name: 'Wall curlers', how: 'Hit 10 curlers at a wall target from 12 m, focusing on plant foot.', reps: '3 x 10' },
    { name: 'Slow-mo reps', how: 'Half-speed kicks, pause at plant, check knee over ball.', reps: '2 x 8' },
  ],
  confidence: 0.82,
  retry_reason: null,
};

describe('parseCoachingResult', () => {
  it('accepts the spec example', () => {
    const r = parseCoachingResult(JSON.stringify(valid));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.kick_rating).toBe(72);
  });

  it('tolerates code fences and leading prose', () => {
    const r = parseCoachingResult('Here you go:\n```json\n' + JSON.stringify(valid) + '\n```');
    expect(r.ok).toBe(true);
  });

  it('repairs a total that drifts by ≤2 from the sub-score sum', () => {
    const r = parseCoachingResult(JSON.stringify({ ...valid, kick_rating: 74 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.kick_rating).toBe(72);
  });

  it('rejects a total that does not match sub-scores', () => {
    const r = parseCoachingResult(JSON.stringify({ ...valid, kick_rating: 90 }));
    expect(r.ok).toBe(false);
  });

  it('rejects a one_fix longer than two sentences', () => {
    const r = parseCoachingResult(JSON.stringify({ ...valid, one_fix: 'One. Two. Three sentences here.' }));
    expect(r.ok).toBe(false);
  });

  it('rejects wrong drill count when rated', () => {
    const r = parseCoachingResult(JSON.stringify({ ...valid, drills: valid.drills.slice(0, 2) }));
    expect(r.ok).toBe(false);
  });

  it('accepts an unusable-video response', () => {
    const r = parseCoachingResult(
      JSON.stringify({ kick_type: 'driven', kick_rating: null, sub_scores: null, one_fix: '', why_it_matters: '', drills: [], confidence: 0.2, retry_reason: 'Only the legs are visible. Step back so your whole body is in frame.' }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.retry_reason).toContain('whole body');
  });

  it('requires retry_reason when unrated', () => {
    const r = parseCoachingResult(JSON.stringify({ ...valid, kick_rating: null, sub_scores: null, retry_reason: null }));
    expect(r.ok).toBe(false);
  });

  it('rejects unknown kick types and garbage', () => {
    expect(parseCoachingResult(JSON.stringify({ ...valid, kick_type: 'volley' })).ok).toBe(false);
    expect(parseCoachingResult('not json at all').ok).toBe(false);
  });
});
