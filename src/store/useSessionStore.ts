import { create } from 'zustand';

import type { KickType } from '@/constants/kicks';
import type { AnalysisProgress } from '@/features/analysis/types';
import type { PoseFrame } from '@/features/pose/types';

/** Ephemeral state for the current record → analyze → result flow. Not persisted. */
interface SessionState {
  kickType: KickType;
  videoUri: string | null;
  durationSec: number | null;
  source: 'camera' | 'import';
  /** Live pose frames captured while recording (camera source only). */
  poseFrames: PoseFrame[];
  retakeOfId: string | null;
  /** Analysis id the current poseFrames belong to (set when the pipeline finishes). */
  lastAnalysisId: string | null;
  progress: AnalysisProgress;
  setKickType: (k: KickType) => void;
  setClip: (uri: string, durationSec: number | null, source: 'camera' | 'import') => void;
  setPoseFrames: (frames: PoseFrame[]) => void;
  setRetakeOf: (id: string | null) => void;
  setProgress: (p: AnalysisProgress) => void;
  /** Reset clip state after an analysis; keeps poseFrames for the result screen overlay. */
  finishClip: (analysisId: string) => void;
  clearClip: () => void;
}

const idleProgress: AnalysisProgress = { stage: 'idle', progress: 0, messageKey: 'analyzing.stages.preparing' };

export const useSessionStore = create<SessionState>()((set) => ({
  kickType: 'driven',
  videoUri: null,
  durationSec: null,
  source: 'camera',
  poseFrames: [],
  retakeOfId: null,
  lastAnalysisId: null,
  progress: idleProgress,
  setKickType: (kickType) => set({ kickType }),
  setClip: (videoUri, durationSec, source) => set({ videoUri, durationSec, source }),
  setPoseFrames: (poseFrames) => set({ poseFrames }),
  setRetakeOf: (retakeOfId) => set({ retakeOfId }),
  setProgress: (progress) => set({ progress }),
  finishClip: (lastAnalysisId) => set({ videoUri: null, durationSec: null, lastAnalysisId, progress: idleProgress }),
  clearClip: () => set({ videoUri: null, durationSec: null, poseFrames: [], lastAnalysisId: null, progress: idleProgress }),
}));
