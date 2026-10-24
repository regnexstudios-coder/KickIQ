import type { KickType } from '@/constants/kicks';
import type { KickMetrics } from '@/features/pose/types';

import type { CoachingResult } from './types';

/** Deterministic offline coach for demos, simulators and tests. Derives scores from metrics when present. */
export function mockCoaching(kickType: KickType, metrics: KickMetrics | null, seed = 0): CoachingResult {
  const base = metrics
    ? {
        approach: clamp(25 - Math.round(Math.abs(metrics.approach_angle_deg - (kickType === 'curler' ? 35 : 15)) / 6), 8, 25),
        plant_foot: clamp(25 - Math.round(Math.max(0, metrics.plant_foot_distance_cm - 20) / 4) - Math.round(Math.abs(metrics.plant_foot_angle_deg) / 15), 6, 25),
        contact: clamp((metrics.knee_over_ball ? 22 : 15) - Math.round(Math.max(0, -metrics.torso_lean_deg) / 10), 6, 25),
        follow_through: clamp(Math.round(14 + metrics.follow_through_height * 12), 6, 25),
      }
    : { approach: 16 + (seed % 4), plant_foot: 14 + (seed % 3), contact: 17, follow_through: 18 };
  const total = base.approach + base.plant_foot + base.contact + base.follow_through;
  const far = metrics ? metrics.plant_foot_distance_cm > 28 : true;
  return {
    kick_type: kickType,
    kick_rating: total,
    sub_scores: base,
    one_fix: far
      ? `Your plant foot lands about ${metrics?.plant_foot_distance_cm ?? 30} cm from the ball, so you lean back and lift it. Plant level with the ball, 15–20 cm beside it, toes at the target.`
      : 'Your knee is behind the ball at contact, so the shot pops up. Drive the kicking knee over the ball and keep your chest down through the strike.',
    why_it_matters: 'A closer plant foot keeps your knee over the ball and the shot low and hard.',
    drills: [
      { name: 'Cone plant drill', how: 'Place a cone a hand-width beside the ball. Plant your foot touching the cone every rep, then strike.', reps: '3 x 10' },
      { name: 'Wall strikes', how: 'From 12 m, hit a chest-high target on a wall. Freeze your finish and check your knee is over where the ball was.', reps: '3 x 10' },
      { name: 'Slow-mo reps', how: 'Half-speed kicks. Pause at plant, check foot position and chest angle, then finish the swing.', reps: '2 x 8' },
    ],
    confidence: metrics ? Math.min(0.95, 0.55 + metrics.tracking_quality * 0.4) : 0.55,
    retry_reason: null,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
