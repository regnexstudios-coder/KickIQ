import type { KeyFramePhase } from '@/features/analysis/types';

import { argmax, argmin, clamp, jointSpeeds, sided } from './geometry';
import type { PoseFrame, Side } from './types';

export interface PhaseIndices {
  approach_start: number;
  plant: number;
  contact: number;
  follow_through: number;
  ball_flight: number;
  finish: number;
  kickingFoot: Side;
}

/**
 * Locate the kick phases from ankle kinematics.
 * - contact: peak speed of the kicking ankle (the swing is the fastest thing in the clip)
 * - kicking foot: the ankle with the higher peak speed
 * - plant: last local minimum of the plant ankle speed before contact (foot grounded)
 * - approach start: first frame where hip speed rises above 20% of its peak
 * - follow-through: ~150 ms after contact (or max kicking-ankle height after contact)
 * - ball flight: ~400 ms after contact, finish: last tracked frame
 */
export function detectPhases(frames: PoseFrame[]): PhaseIndices | null {
  const n = frames.length;
  if (n < 6) return null;
  const left = jointSpeeds(frames, 'left_ankle');
  const right = jointSpeeds(frames, 'right_ankle');
  const li = argmax(left);
  const ri = argmax(right);
  const kickingFoot: Side = (right[ri] ?? 0) >= (left[li] ?? 0) ? 'right' : 'left';
  const kickSpeeds = kickingFoot === 'right' ? right : left;
  const plantSpeeds = kickingFoot === 'right' ? left : right;
  const contact = kickingFoot === 'right' ? ri : li;

  // Plant: minimum plant-ankle speed in the 400 ms window before contact.
  const tContact = frames[contact]!.t;
  let plantFrom = contact;
  while (plantFrom > 0 && tContact - frames[plantFrom - 1]!.t < 0.4) plantFrom--;
  const plant = argmin(plantSpeeds, plantFrom, Math.max(plantFrom + 1, contact));

  // Approach start: hip speed threshold.
  const hipSpeedL = jointSpeeds(frames, 'left_hip');
  const hipSpeedR = jointSpeeds(frames, 'right_hip');
  const hip = hipSpeedL.map((v, i) => (v + (hipSpeedR[i] ?? 0)) / 2);
  const hipPeak = Math.max(...hip.slice(0, contact + 1), 1e-6);
  let approach_start = 0;
  for (let i = 0; i < contact; i++) {
    if ((hip[i] ?? 0) > hipPeak * 0.2) {
      approach_start = i;
      break;
    }
  }

  const idxAt = (t: number) => {
    let best = n - 1;
    for (let i = contact; i < n; i++) {
      if (frames[i]!.t >= t) {
        best = i;
        break;
      }
    }
    return best;
  };
  const follow_through = clamp(idxAt(tContact + 0.15), contact, n - 1);
  const ball_flight = clamp(idxAt(tContact + 0.4), follow_through, n - 1);
  const finish = n - 1;

  // Sanity: the kicking ankle must actually move. If the peak speed is tiny there was no kick.
  if ((kickSpeeds[contact] ?? 0) < 0.3) return null;

  // Guard against a plant foot that is actually the swing foot mis-assigned on a static clip.
  if (sided(frames[contact]!, kickingFoot, 'ankle').score < 0.2) return null;

  return { approach_start, plant, contact, follow_through, ball_flight, finish, kickingFoot };
}

export function phaseTimes(frames: PoseFrame[], p: PhaseIndices): Record<KeyFramePhase, number> {
  return {
    approach: frames[p.approach_start]!.t,
    plant: frames[p.plant]!.t,
    contact: frames[p.contact]!.t,
    follow_through: frames[p.follow_through]!.t,
    ball_flight: frames[p.ball_flight]!.t,
    finish: frames[p.finish]!.t,
  };
}

/** No pose data (imported clip): spread key frames across the clip around an assumed mid-clip contact. */
export function fallbackPhaseTimes(durationSec: number): Record<KeyFramePhase, number> {
  const d = Math.max(1, durationSec);
  return {
    approach: d * 0.2,
    plant: d * 0.42,
    contact: d * 0.5,
    follow_through: d * 0.58,
    ball_flight: d * 0.72,
    finish: Math.max(0, d - 0.3),
  };
}
