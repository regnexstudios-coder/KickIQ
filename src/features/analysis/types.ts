import type { KickType } from '@/constants/kicks';
import type { KickMetrics } from '@/features/pose/types';

export interface SubScores {
  approach: number;
  plant_foot: number;
  contact: number;
  follow_through: number;
}

export const SUB_SCORE_KEYS = ['approach', 'plant_foot', 'contact', 'follow_through'] as const;
export type SubScoreKey = (typeof SUB_SCORE_KEYS)[number];

export interface Drill {
  name: string;
  how: string;
  reps: string;
}

/** Validated output of the coaching model (see schema.ts). */
export interface CoachingResult {
  kick_type: KickType;
  kick_rating: number | null;
  sub_scores: SubScores | null;
  one_fix: string;
  why_it_matters: string;
  drills: Drill[];
  confidence: number;
  retry_reason: string | null;
}

export type KeyFramePhase =
  | 'approach'
  | 'plant'
  | 'contact'
  | 'follow_through'
  | 'ball_flight'
  | 'finish';

export const KEY_FRAME_PHASES: KeyFramePhase[] = [
  'approach',
  'plant',
  'contact',
  'follow_through',
  'ball_flight',
  'finish',
];

export interface KeyFrame {
  phase: KeyFramePhase;
  /** Seconds from clip start. */
  timeSec: number;
  /** Local JPEG uri, when extracted. */
  uri?: string;
}

/** A saved analysis (local-first; mirrored to Supabase `analyses`). */
export interface Analysis {
  id: string;
  userId: string | null;
  kickType: KickType;
  kickRating: number;
  subScores: SubScores;
  oneFix: string;
  whyItMatters: string;
  drills: Drill[];
  metrics: KickMetrics | null;
  confidence: number;
  /** Local file uri. Raw video never leaves the device. */
  videoUri: string | null;
  thumbnailUri: string | null;
  keyFrames: KeyFrame[];
  scoreCardUri: string | null;
  /** When this analysis is a retake, the id of the analysis it compares against. */
  retakeOfId: string | null;
  source: 'camera' | 'import';
  createdAt: string;
  synced: boolean;
}

export type AnalysisStage =
  | 'idle'
  | 'preparing'
  | 'extracting_frames'
  | 'measuring'
  | 'coaching'
  | 'validating'
  | 'done'
  | 'error'
  | 'retry';

export interface AnalysisProgress {
  stage: AnalysisStage;
  /** 0..1 */
  progress: number;
  messageKey: string;
}
