import type { KickType } from '@/constants/kicks';
import { computeMetrics } from '@/features/pose/metrics';
import { detectPhases, fallbackPhaseTimes, phaseTimes } from '@/features/pose/phases';
import type { KickMetrics, PoseFrame } from '@/features/pose/types';
import { isConfigured } from '@/lib/config';
import { newId } from '@/lib/ids';

import { CoachError, requestCoaching } from './gemini';
import { extractKeyFrames, keyFramesToBase64 } from './keyframes';
import { mockCoaching } from './mockCoach';
import type { Analysis, AnalysisProgress, CoachingResult, KeyFrame } from './types';

export interface PipelineInput {
  kickType: KickType;
  videoUri: string;
  durationSec: number | null;
  source: 'camera' | 'import';
  poseFrames: PoseFrame[];
  heightCm: number | null;
  level: string | null;
  weakness: string | null;
  retakeOfId: string | null;
  userId: string | null;
  /** Force the offline coach (demo mode / no network). */
  offline?: boolean;
}

export type PipelineOutcome =
  | { kind: 'analysis'; analysis: Analysis }
  | { kind: 'retry'; reason: string; keyFrames: KeyFrame[] }
  | { kind: 'error'; error: CoachError | Error };

export type ProgressFn = (p: AnalysisProgress) => void;

const step = (stage: AnalysisProgress['stage'], progress: number, messageKey: string): AnalysisProgress => ({ stage, progress, messageKey });

/**
 * Full analysis: pose → phases → metrics → key frames → coach → validated result.
 * Never uploads the video; only 6 JPEG key frames and the metrics JSON leave the device.
 */
export async function runAnalysis(input: PipelineInput, onProgress: ProgressFn): Promise<PipelineOutcome> {
  try {
    onProgress(step('preparing', 0.05, 'analyzing.stages.preparing'));

    // 1. Metrics + phase timing from on-device pose (camera source only).
    onProgress(step('measuring', 0.15, 'analyzing.stages.measuring'));
    let metrics: KickMetrics | null = null;
    let times = fallbackPhaseTimes(input.durationSec ?? 5);
    if (input.poseFrames.length >= 6) {
      const phases = detectPhases(input.poseFrames);
      if (phases) {
        times = phaseTimes(input.poseFrames, phases);
        metrics = computeMetrics(input.poseFrames, { heightCm: input.heightCm ?? undefined });
      }
    }
    onProgress(step('measuring', 0.3, metrics ? 'analyzing.stages.measuring2' : 'analyzing.stages.extracting_frames'));

    // 2. Key frames.
    onProgress(step('extracting_frames', 0.4, 'analyzing.stages.extracting_frames'));
    const keyFrames = await extractKeyFrames(input.videoUri, times, input.durationSec);
    onProgress(step('measuring', 0.5, 'analyzing.stages.measuring3'));

    // 3. Coach.
    onProgress(step('coaching', 0.6, 'analyzing.stages.coaching'));
    let result: CoachingResult;
    const useMock = input.offline || !isConfigured.gemini;
    if (useMock) {
      await new Promise((r) => setTimeout(r, 1200));
      result = mockCoaching(input.kickType, metrics, input.videoUri.length);
    } else {
      const { order, data } = await keyFramesToBase64(keyFrames);
      result = await requestCoaching({
        kickType: input.kickType,
        metrics,
        heightCm: input.heightCm,
        level: input.level,
        weakness: input.weakness,
        source: input.source,
        frameOrder: order,
        framesBase64: data,
      });
    }
    onProgress(step('coaching', 0.85, 'analyzing.stages.coaching2'));
    onProgress(step('validating', 0.95, 'analyzing.stages.validating'));

    if (result.kick_rating == null || !result.sub_scores) {
      return { kind: 'retry', reason: result.retry_reason ?? '', keyFrames };
    }

    const analysis: Analysis = {
      id: newId('kick'),
      userId: input.userId,
      kickType: input.kickType,
      kickRating: result.kick_rating,
      subScores: result.sub_scores,
      oneFix: result.one_fix,
      whyItMatters: result.why_it_matters,
      drills: result.drills,
      metrics,
      confidence: result.confidence,
      videoUri: input.videoUri,
      thumbnailUri: keyFrames.find((k) => k.phase === 'contact')?.uri ?? keyFrames.find((k) => k.uri)?.uri ?? null,
      keyFrames,
      scoreCardUri: null,
      retakeOfId: input.retakeOfId,
      source: input.source,
      createdAt: new Date().toISOString(),
      synced: false,
    };
    onProgress(step('done', 1, 'analyzing.stages.done'));
    return { kind: 'analysis', analysis };
  } catch (e) {
    return { kind: 'error', error: e as Error };
  }
}
