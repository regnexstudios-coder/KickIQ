/**
 * Pose types are model-agnostic. The on-device engine (MoveNet, 17 COCO keypoints)
 * fills the named joints below. A 33-landmark MediaPipe model maps onto the same names.
 */
export const JOINTS = [
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
] as const;
export type Joint = (typeof JOINTS)[number];

export interface Keypoint {
  /** Normalised 0..1, x to the right, y downwards, image space. */
  x: number;
  y: number;
  /** 0..1 */
  score: number;
}

export interface PoseFrame {
  /** Seconds from clip start. */
  t: number;
  keypoints: Record<Joint, Keypoint>;
}

export type Side = 'left' | 'right';

export interface KickMetrics {
  /** Which foot struck the ball. */
  kicking_foot: Side;
  /** Horizontal plant-foot to ball distance at contact, cm (ball ≈ kicking ankle at contact). */
  plant_foot_distance_cm: number;
  /** Plant-foot direction vs. target line, degrees (0 = pointing at target). */
  plant_foot_angle_deg: number;
  /** Kicking-side knee ahead of the ball at contact. */
  knee_over_ball: boolean;
  /** Knee-over-ball lean, degrees (+ = knee ahead of ankle). */
  knee_over_ball_deg: number;
  hip_rotation_deg: number;
  shoulder_rotation_deg: number;
  /** Torso lean at contact, degrees (+ forward, − back). */
  torso_lean_deg: number;
  /** Max backswing height of kicking ankle before contact, as fraction of leg length (0..1+). */
  backswing_height: number;
  /** Follow-through height of kicking ankle after contact, as fraction of leg length. */
  follow_through_height: number;
  follow_through_direction: 'toward_target' | 'across_body' | 'low_and_short';
  /** Approach angle relative to the target line, degrees. */
  approach_angle_deg: number;
  approach_steps: number;
  head_down_at_contact: boolean;
  /** Mean keypoint confidence across phases, 0..1. */
  tracking_quality: number;
  /** Key moments in seconds from clip start. */
  timings: {
    approach_start: number;
    plant: number;
    contact: number;
    follow_through: number;
    ball_flight: number;
    finish: number;
  };
}

export interface PoseEngineResult {
  frames: PoseFrame[];
  fps: number;
  durationSec: number;
}
