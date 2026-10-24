import type { Joint, Keypoint, PoseFrame, Side } from './types';

export interface Vec {
  x: number;
  y: number;
}

export const RAD = 180 / Math.PI;

export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const len = (v: Vec): number => Math.hypot(v.x, v.y);

/** Angle of vector in degrees, 0 = +x (right), positive clockwise in image space (y down). */
export const angleDeg = (v: Vec): number => Math.atan2(v.y, v.x) * RAD;

/** Interior angle at vertex b for a-b-c, degrees. */
export function jointAngle(a: Vec, b: Vec, c: Vec): number {
  const v1 = sub(a, b);
  const v2 = sub(c, b);
  const cos = (v1.x * v2.x + v1.y * v2.y) / (len(v1) * len(v2) || 1);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * RAD;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const other = (s: Side): Side => (s === 'left' ? 'right' : 'left');

export const joint = (f: PoseFrame, j: Joint): Keypoint => f.keypoints[j];
export const sided = (f: PoseFrame, side: Side, part: 'ankle' | 'knee' | 'hip' | 'shoulder' | 'wrist' | 'elbow'): Keypoint =>
  f.keypoints[`${side}_${part}` as Joint];

/** Mean confidence of the frame's lower body + shoulders. */
export function frameQuality(f: PoseFrame): number {
  const js: Joint[] = ['left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle', 'left_shoulder', 'right_shoulder'];
  return js.reduce((s, j) => s + f.keypoints[j].score, 0) / js.length;
}

/** Body scale in normalised units: hip-to-ankle length averaged over frames with good confidence. */
export function legLength(frames: PoseFrame[]): number {
  const vals: number[] = [];
  for (const f of frames) {
    for (const s of ['left', 'right'] as Side[]) {
      const hip = sided(f, s, 'hip');
      const knee = sided(f, s, 'knee');
      const ankle = sided(f, s, 'ankle');
      if (hip.score > 0.4 && knee.score > 0.4 && ankle.score > 0.4) vals.push(dist(hip, knee) + dist(knee, ankle));
    }
  }
  if (vals.length === 0) return 0.35;
  vals.sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)] ?? 0.35;
}

/** Simple exponential smoothing of keypoints to tame jitter. */
export function smoothFrames(frames: PoseFrame[], alpha = 0.5): PoseFrame[] {
  if (frames.length === 0) return frames;
  const out: PoseFrame[] = [];
  let prev = frames[0]!;
  out.push(prev);
  for (let i = 1; i < frames.length; i++) {
    const cur = frames[i]!;
    const keypoints = {} as PoseFrame['keypoints'];
    for (const j of Object.keys(cur.keypoints) as Joint[]) {
      const p = prev.keypoints[j];
      const c = cur.keypoints[j];
      // Low-confidence points lean on the previous value.
      const a = c.score < 0.3 ? alpha * 0.4 : alpha;
      keypoints[j] = { x: p.x + (c.x - p.x) * a, y: p.y + (c.y - p.y) * a, score: Math.max(c.score, p.score * 0.8) };
    }
    const sm: PoseFrame = { t: cur.t, keypoints };
    out.push(sm);
    prev = sm;
  }
  return out;
}

/** Per-frame speed (normalised units / second) of a joint, central differences. */
export function jointSpeeds(frames: PoseFrame[], j: Joint): number[] {
  const n = frames.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const a = frames[Math.max(0, i - 1)]!;
    const b = frames[Math.min(n - 1, i + 1)]!;
    const dt = b.t - a.t || 1e-3;
    out[i] = dist(a.keypoints[j], b.keypoints[j]) / dt;
  }
  return out;
}

export function argmax(arr: number[], from = 0, to = arr.length): number {
  let bi = from;
  for (let i = from; i < to; i++) if ((arr[i] ?? -Infinity) > (arr[bi] ?? -Infinity)) bi = i;
  return bi;
}

export function argmin(arr: number[], from = 0, to = arr.length): number {
  let bi = from;
  for (let i = from; i < to; i++) if ((arr[i] ?? Infinity) < (arr[bi] ?? Infinity)) bi = i;
  return bi;
}
