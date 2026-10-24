import { File } from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';

import type { KeyFrame, KeyFramePhase } from './types';
import { KEY_FRAME_PHASES } from './types';

/** Extract one JPEG per phase from the local clip. Returns frames with local uris. */
export async function extractKeyFrames(
  videoUri: string,
  times: Record<KeyFramePhase, number>,
  durationSec: number | null,
): Promise<KeyFrame[]> {
  const out: KeyFrame[] = [];
  const maxT = durationSec ? Math.max(0, durationSec - 0.05) : Infinity;
  for (const phase of KEY_FRAME_PHASES) {
    const timeSec = Math.min(Math.max(0, times[phase]), maxT);
    try {
      const res = await VideoThumbnails.getThumbnailAsync(videoUri, { time: Math.round(timeSec * 1000), quality: 0.6 });
      out.push({ phase, timeSec, uri: res.uri });
    } catch {
      out.push({ phase, timeSec });
    }
  }
  return out;
}

export async function keyFramesToBase64(frames: KeyFrame[]): Promise<{ order: string[]; data: string[] }> {
  const order: string[] = [];
  const data: string[] = [];
  for (const f of frames) {
    if (!f.uri) continue;
    try {
      const b64 = await new File(f.uri).base64();
      order.push(f.phase);
      data.push(b64);
    } catch {
      // skip unreadable frame
    }
  }
  return { order, data };
}
