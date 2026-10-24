import Svg, { Circle, Line } from 'react-native-svg';

import type { Joint, PoseFrame } from '@/features/pose/types';
import { colors } from '@/lib/theme';

const BONES: [Joint, Joint][] = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
];

interface SkeletonOverlayProps {
  frame: PoseFrame | null;
  width: number;
  height: number;
  minScore?: number;
  highlight?: Joint[];
}

/** Draws a pose skeleton over a video/camera surface. Coordinates are normalised 0..1. */
export function SkeletonOverlay({ frame, width, height, minScore = 0.3, highlight = [] }: SkeletonOverlayProps) {
  if (!frame) return null;
  const kp = frame.keypoints;
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
      {BONES.map(([a, b]) => {
        const p = kp[a];
        const q = kp[b];
        if (p.score < minScore || q.score < minScore) return null;
        return (
          <Line
            key={`${a}-${b}`}
            x1={p.x * width}
            y1={p.y * height}
            x2={q.x * width}
            y2={q.y * height}
            stroke={colors.pitch}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.9}
          />
        );
      })}
      {(Object.keys(kp) as Joint[]).map((j) => {
        const p = kp[j];
        if (p.score < minScore) return null;
        const hot = highlight.includes(j);
        return (
          <Circle
            key={j}
            cx={p.x * width}
            cy={p.y * height}
            r={hot ? 7 : 4}
            fill={hot ? colors.gold : colors.ink}
            stroke={colors.bg}
            strokeWidth={1.5}
          />
        );
      })}
    </Svg>
  );
}
