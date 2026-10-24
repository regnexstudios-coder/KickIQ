import { mockKickFrames } from '@/features/pose/mock';
import { computeMetrics } from '@/features/pose/metrics';
import { detectPhases, fallbackPhaseTimes, phaseTimes } from '@/features/pose/phases';
import { legLength, smoothFrames } from '@/features/pose/geometry';

describe('phase detection', () => {
  it('finds contact at the kicking-ankle speed peak and orders phases', () => {
    const frames = mockKickFrames({ durationSec: 4, fps: 20, noise: 0 });
    const p = detectPhases(frames);
    expect(p).not.toBeNull();
    expect(p!.kickingFoot).toBe('right');
    expect(p!.approach_start).toBeLessThanOrEqual(p!.plant);
    expect(p!.plant).toBeLessThanOrEqual(p!.contact);
    expect(p!.contact).toBeLessThan(p!.follow_through);
    expect(p!.follow_through).toBeLessThanOrEqual(p!.ball_flight);
    expect(p!.ball_flight).toBeLessThanOrEqual(p!.finish);
    const t = phaseTimes(frames, p!);
    // Contact is scripted at 60% of the clip; allow the swing window.
    expect(t.contact).toBeGreaterThan(2.2);
    expect(t.contact).toBeLessThan(3.0);
  });

  it('detects a left-footed kick', () => {
    const p = detectPhases(mockKickFrames({ kickingFoot: 'left', noise: 0 }));
    expect(p?.kickingFoot).toBe('left');
  });

  it('returns null for too few frames or a static clip', () => {
    expect(detectPhases(mockKickFrames({ durationSec: 0.2, fps: 10 }))).toBeNull();
    const still = mockKickFrames({ durationSec: 3, fps: 10, noise: 0 }).map((f, i, arr) => ({ ...arr[0]!, t: f.t }));
    expect(detectPhases(still)).toBeNull();
  });

  it('fallback times are monotonic and inside the clip', () => {
    const t = fallbackPhaseTimes(8);
    expect(t.approach).toBeLessThan(t.plant);
    expect(t.plant).toBeLessThan(t.contact);
    expect(t.contact).toBeLessThan(t.follow_through);
    expect(t.finish).toBeLessThanOrEqual(8);
  });
});

describe('computeMetrics', () => {
  it('produces every metric with sane ranges', () => {
    const m = computeMetrics(mockKickFrames({ noise: 0.002 }), { heightCm: 170 });
    expect(m).not.toBeNull();
    expect(m!.kicking_foot).toBe('right');
    expect(m!.plant_foot_distance_cm).toBeGreaterThanOrEqual(0);
    expect(m!.plant_foot_distance_cm).toBeLessThan(120);
    expect(Math.abs(m!.plant_foot_angle_deg)).toBeLessThanOrEqual(60);
    expect(m!.hip_rotation_deg).toBeGreaterThanOrEqual(0);
    expect(m!.shoulder_rotation_deg).toBeLessThanOrEqual(90);
    expect(Math.abs(m!.torso_lean_deg)).toBeLessThanOrEqual(60);
    expect(m!.backswing_height).toBeGreaterThan(0);
    expect(m!.follow_through_height).toBeGreaterThanOrEqual(0);
    expect(['toward_target', 'across_body', 'low_and_short']).toContain(m!.follow_through_direction);
    expect(m!.approach_steps).toBeGreaterThanOrEqual(1);
    expect(m!.tracking_quality).toBeGreaterThan(0.5);
    expect(m!.timings.plant).toBeLessThanOrEqual(m!.timings.contact);
  });

  it('plant foot further behind the ball yields a larger distance', () => {
    const near = computeMetrics(mockKickFrames({ plantBehind: 0.05, noise: 0 }), { heightCm: 170 })!;
    const far = computeMetrics(mockKickFrames({ plantBehind: 0.6, noise: 0 }), { heightCm: 170 })!;
    expect(far.plant_foot_distance_cm).toBeGreaterThan(near.plant_foot_distance_cm);
  });

  it('leaning back shows as negative torso lean', () => {
    const upright = computeMetrics(mockKickFrames({ leanBack: 0, noise: 0 }))!;
    const back = computeMetrics(mockKickFrames({ leanBack: 0.8, noise: 0 }))!;
    expect(back.torso_lean_deg).toBeLessThan(upright.torso_lean_deg);
  });

  it('scales distances with player height', () => {
    const small = computeMetrics(mockKickFrames({ noise: 0, plantBehind: 0.5 }), { heightCm: 150 })!;
    const tall = computeMetrics(mockKickFrames({ noise: 0, plantBehind: 0.5 }), { heightCm: 190 })!;
    expect(tall.plant_foot_distance_cm).toBeGreaterThan(small.plant_foot_distance_cm);
  });
});

describe('geometry helpers', () => {
  it('smoothing keeps frame count and timestamps', () => {
    const frames = mockKickFrames({ durationSec: 2, fps: 10 });
    const sm = smoothFrames(frames);
    expect(sm).toHaveLength(frames.length);
    expect(sm.map((f) => f.t)).toEqual(frames.map((f) => f.t));
  });
  it('leg length is a plausible fraction of the frame', () => {
    const l = legLength(mockKickFrames({ noise: 0 }));
    expect(l).toBeGreaterThan(0.2);
    expect(l).toBeLessThan(0.5);
  });
});
