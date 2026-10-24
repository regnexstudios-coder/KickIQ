import { RAD, angleDeg, clamp, dist, frameQuality, jointAngle, legLength, mid, sided, smoothFrames, sub } from './geometry';
import { detectPhases, type PhaseIndices } from './phases';
import type { KickMetrics, PoseFrame, Side } from './types';

export interface MetricsOptions {
  /** Player height in cm; defaults to a typical 13–18 player. */
  heightCm?: number;
  /** Direction of the target in image space: +1 = player kicks to the right, −1 = to the left. Auto if omitted. */
  targetDir?: 1 | -1;
}

/** Hip-to-ankle is ~53% of standing height (anthropometric average). */
const LEG_TO_HEIGHT = 0.53;

/** Infer target direction from the kicking ankle's motion through contact. */
function inferTargetDir(frames: PoseFrame[], p: PhaseIndices): 1 | -1 {
  const a = sided(frames[Math.max(0, p.contact - 2)]!, p.kickingFoot, 'ankle');
  const b = sided(frames[Math.min(frames.length - 1, p.contact + 2)]!, p.kickingFoot, 'ankle');
  return b.x - a.x >= 0 ? 1 : -1;
}

function countSteps(frames: PoseFrame[], from: number, to: number): number {
  // A step = one foot's vertical position going up then down. Count peaks of ankle height for both feet.
  let steps = 0;
  for (const side of ['left', 'right'] as Side[]) {
    const ys = frames.slice(from, to + 1).map((f) => sided(f, side, 'ankle').y);
    const amp = Math.max(...ys) - Math.min(...ys);
    const thresh = amp * 0.25;
    for (let i = 1; i < ys.length - 1; i++) {
      const y = ys[i]!;
      if (y < ys[i - 1]! && y <= ys[i + 1]! && Math.min(ys[i - 1]!, ys[i + 1]!) - y > thresh * 0.3) steps++;
    }
  }
  return clamp(steps, 1, 12);
}

/**
 * Compute coaching metrics from a pose sequence. Returns null when no kick is detected.
 * All distances are estimates derived from body scale (leg length ≈ 53% of height).
 */
export function computeMetrics(rawFrames: PoseFrame[], opts: MetricsOptions = {}): KickMetrics | null {
  const frames = smoothFrames(rawFrames);
  const p = detectPhases(frames);
  if (!p) return null;

  const heightCm = opts.heightCm ?? 165;
  const legNorm = legLength(frames);
  const cmPerUnit = (heightCm * LEG_TO_HEIGHT) / legNorm;
  const targetDir = opts.targetDir ?? inferTargetDir(frames, p);
  const kick = p.kickingFoot;
  const plantSide: Side = kick === 'left' ? 'right' : 'left';

  const fContact = frames[p.contact]!;
  const fPlant = frames[p.plant]!;
  const fApproach = frames[p.approach_start]!;
  const fFollow = frames[p.follow_through]!;

  // Ball ≈ kicking ankle at contact.
  const ball = sided(fContact, kick, 'ankle');
  const plantAnkle = sided(fContact, plantSide, 'ankle');
  const plantKnee = sided(fContact, plantSide, 'knee');
  const plant_foot_distance_cm = Math.abs(plantAnkle.x - ball.x) * cmPerUnit;

  // Plant-foot direction: knee→ankle vector of the plant leg projected onto the ground plane vs target line.
  const plantVec = sub(plantAnkle, plantKnee);
  const plant_foot_angle_deg = clamp(Math.abs(angleDeg({ x: plantVec.x * targetDir, y: plantVec.y })) - 90, -60, 60);

  // Knee over ball: kicking knee ahead (toward target) of the ball at contact.
  const kickKnee = sided(fContact, kick, 'knee');
  const kneeLead = (kickKnee.x - ball.x) * targetDir;
  const knee_over_ball_deg = Math.atan2(kneeLead, Math.max(1e-3, ball.y - kickKnee.y)) * RAD;
  const knee_over_ball = knee_over_ball_deg > -5;

  // Rotations: shoulder/hip line angle vs the target line (side view → mostly fore-aft offset).
  const hipLine = sub(sided(fContact, 'right', 'hip'), sided(fContact, 'left', 'hip'));
  const shoulderLine = sub(sided(fContact, 'right', 'shoulder'), sided(fContact, 'left', 'shoulder'));
  const hipWidthRef = Math.max(1e-3, legNorm * 0.45);
  const hip_rotation_deg = clamp(Math.asin(clamp(Math.abs(hipLine.x) / hipWidthRef, 0, 1)) * RAD, 0, 90);
  const shoulder_rotation_deg = clamp(Math.asin(clamp(Math.abs(shoulderLine.x) / (hipWidthRef * 1.25), 0, 1)) * RAD, 0, 90);

  // Torso lean: shoulders-mid vs hips-mid, positive toward target.
  const hipMid = mid(sided(fContact, 'left', 'hip'), sided(fContact, 'right', 'hip'));
  const shMid = mid(sided(fContact, 'left', 'shoulder'), sided(fContact, 'right', 'shoulder'));
  const torso = sub(shMid, hipMid);
  const torso_lean_deg = clamp(Math.atan2(torso.x * targetDir, -torso.y) * RAD, -60, 60);

  // Backswing: max height of kicking ankle above the plant ankle before contact (fraction of leg length).
  let backswing = 0;
  for (let i = p.plant; i <= p.contact; i++) {
    const f = frames[i]!;
    const h = (sided(f, plantSide, 'ankle').y - sided(f, kick, 'ankle').y) / legNorm;
    backswing = Math.max(backswing, h);
  }
  // Follow-through height after contact.
  let follow = 0;
  let followDx = 0;
  for (let i = p.contact; i <= p.ball_flight; i++) {
    const f = frames[i]!;
    const h = (sided(f, plantSide, 'ankle').y - sided(f, kick, 'ankle').y) / legNorm;
    if (h > follow) {
      follow = h;
      followDx = (sided(f, kick, 'ankle').x - ball.x) * targetDir;
    }
  }
  const follow_through_direction: KickMetrics['follow_through_direction'] =
    follow < 0.25 ? 'low_and_short' : followDx < -0.05 ? 'across_body' : 'toward_target';

  // Approach angle: hip-mid displacement from approach start to plant vs the target line.
  const hipStart = mid(sided(fApproach, 'left', 'hip'), sided(fApproach, 'right', 'hip'));
  const hipPlant = mid(sided(fPlant, 'left', 'hip'), sided(fPlant, 'right', 'hip'));
  const run = sub(hipPlant, hipStart);
  const approach_angle_deg = dist(hipStart, hipPlant) < 0.02 ? 0 : clamp(Math.abs(angleDeg({ x: run.x * targetDir, y: run.y })), 0, 90);

  // Head: nose roughly above/ahead of the ball and lower than shoulders → looking down at the ball.
  const nose = fContact.keypoints.nose;
  const headDrop = (nose.y - shMid.y) / legNorm; // positive = below shoulder line (chin down)
  const noseToBall = Math.abs(nose.x - ball.x) / legNorm;
  const head_down_at_contact = nose.score < 0.3 ? true : headDrop > -0.42 && noseToBall < 0.9;

  const quality =
    [fApproach, fPlant, fContact, fFollow].reduce((s, f) => s + frameQuality(f), 0) / 4;

  return {
    kicking_foot: kick,
    plant_foot_distance_cm: round(plant_foot_distance_cm, 0),
    plant_foot_angle_deg: round(plant_foot_angle_deg, 0),
    knee_over_ball,
    knee_over_ball_deg: round(knee_over_ball_deg, 0),
    hip_rotation_deg: round(hip_rotation_deg, 0),
    shoulder_rotation_deg: round(shoulder_rotation_deg, 0),
    torso_lean_deg: round(torso_lean_deg, 0),
    backswing_height: round(clamp(backswing, 0, 1.5), 2),
    follow_through_height: round(clamp(follow, 0, 1.5), 2),
    follow_through_direction,
    approach_angle_deg: round(approach_angle_deg, 0),
    approach_steps: countSteps(frames, p.approach_start, p.plant),
    head_down_at_contact,
    tracking_quality: round(quality, 2),
    timings: {
      approach_start: round(fApproach.t, 2),
      plant: round(fPlant.t, 2),
      contact: round(fContact.t, 2),
      follow_through: round(fFollow.t, 2),
      ball_flight: round(frames[p.ball_flight]!.t, 2),
      finish: round(frames[p.finish]!.t, 2),
    },
  };
}

function round(v: number, d: number): number {
  const m = 10 ** d;
  return Math.round(v * m) / m;
}

/** Knee angle at contact, handy for debugging overlays. */
export function kneeAngleAt(f: PoseFrame, side: Side): number {
  return jointAngle(sided(f, side, 'hip'), sided(f, side, 'knee'), sided(f, side, 'ankle'));
}
