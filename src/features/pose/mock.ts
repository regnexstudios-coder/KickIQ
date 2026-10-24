import { JOINTS, type Joint, type Keypoint, type PoseFrame, type Side } from './types';

export interface MockKickOptions {
  durationSec?: number;
  fps?: number;
  kickingFoot?: Side;
  /** Horizontal plant offset behind the ball in leg-lengths (0.0 = level with ball). */
  plantBehind?: number;
  /** Lean back at contact (0..1). */
  leanBack?: number;
  noise?: number;
}

/**
 * Synthesises a plausible side-on right-footed kick for tests, the simulator, and demos.
 * Player runs left→right, plants the left foot, swings the right leg through at t ≈ 60%.
 */
export function mockKickFrames(opts: MockKickOptions = {}): PoseFrame[] {
  const { durationSec = 4, fps = 15, kickingFoot = 'right', plantBehind = 0.15, leanBack = 0.2, noise = 0.004 } = opts;
  const n = Math.round(durationSec * fps);
  const frames: PoseFrame[] = [];
  const leg = 0.3; // leg length in normalised units
  const contactT = durationSec * 0.6;
  const plantT = contactT - 0.18;
  const rnd = () => (Math.random() - 0.5) * 2 * noise;
  const plant: Side = kickingFoot === 'right' ? 'left' : 'right';

  for (let i = 0; i < n; i++) {
    const t = i / fps;
    // Hip x moves from 0.25 to 0.55 until plant, then holds.
    const progress = Math.min(1, t / plantT);
    const hipX = 0.25 + 0.3 * progress;
    const hipY = 0.55 - 0.02 * Math.sin(progress * Math.PI * 4) ** 2;
    const stride = Math.sin(t * Math.PI * 3.2);

    const lean = t > plantT ? leanBack * Math.min(1, (t - plantT) / 0.2) : 0;
    const shoulderX = hipX - lean * 0.08;
    const shoulderY = hipY - leg * 0.9;
    const kp = {} as Record<Joint, Keypoint>;
    const set = (j: Joint, x: number, y: number, score = 0.9) => (kp[j] = { x: x + rnd(), y: y + rnd(), score });

    set('nose', shoulderX + 0.03, shoulderY - 0.07);
    set('left_eye', shoulderX + 0.02, shoulderY - 0.08);
    set('right_eye', shoulderX + 0.04, shoulderY - 0.08);
    set('left_ear', shoulderX, shoulderY - 0.07);
    set('right_ear', shoulderX + 0.05, shoulderY - 0.07);
    set('left_shoulder', shoulderX - 0.03, shoulderY);
    set('right_shoulder', shoulderX + 0.03, shoulderY);
    set('left_elbow', shoulderX - 0.08, shoulderY + 0.12);
    set('right_elbow', shoulderX + 0.08, shoulderY + 0.1);
    set('left_wrist', shoulderX - 0.1, shoulderY + 0.24);
    set('right_wrist', shoulderX + 0.12, shoulderY + 0.2);
    set('left_hip', hipX - 0.02, hipY);
    set('right_hip', hipX + 0.02, hipY);

    const ballX = 0.55 + leg * 0.35;
    if (t < plantT) {
      // Running: ankles alternate.
      const lx = hipX - 0.02 + stride * 0.12;
      const rx = hipX + 0.02 - stride * 0.12;
      set('left_knee', (hipX + lx) / 2, hipY + leg * 0.5 - Math.max(0, stride) * 0.04);
      set('right_knee', (hipX + rx) / 2, hipY + leg * 0.5 - Math.max(0, -stride) * 0.04);
      set('left_ankle', lx, hipY + leg - Math.max(0, stride) * 0.08);
      set('right_ankle', rx, hipY + leg - Math.max(0, -stride) * 0.08);
    } else {
      // Plant foot grounded behind the ball; kicking leg swings through.
      const plantX = ballX - plantBehind * leg;
      // 0 at plant, 0.5 at contact, 1 at follow-through end. Cosine easing makes ankle speed peak at contact.
      const s = Math.min(1, (t - plantT) / 0.36);
      const ang = -1.2 + 2.6 * (0.5 - 0.5 * Math.cos(Math.PI * s)); // radians, back → forward
      const kx = hipX + Math.sin(ang) * leg;
      const ky = hipY + Math.cos(ang) * leg;
      const kneeX = hipX + Math.sin(ang * 0.6) * leg * 0.5;
      const kneeY = hipY + Math.cos(ang * 0.6) * leg * 0.5;
      const plantKneeX = plantX - 0.01;
      const plantKneeY = hipY + leg * 0.5;
      if (plant === 'left') {
        set('left_knee', plantKneeX, plantKneeY);
        set('left_ankle', plantX, hipY + leg);
        set('right_knee', kneeX, kneeY);
        set('right_ankle', kx, ky);
      } else {
        set('right_knee', plantKneeX, plantKneeY);
        set('right_ankle', plantX, hipY + leg);
        set('left_knee', kneeX, kneeY);
        set('left_ankle', kx, ky);
      }
    }
    for (const j of JOINTS) if (!kp[j]) kp[j] = { x: 0.5, y: 0.5, score: 0 };
    frames.push({ t, keypoints: kp });
  }
  return frames;
}
