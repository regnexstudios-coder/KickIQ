import { Directory, File, Paths } from 'expo-file-system';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import { Platform } from 'react-native';

import { config } from '@/lib/config';

/**
 * MoveNet SinglePose Thunder (TFLite). The model is not committed to the repo (license + size);
 * it is downloaded once from EXPO_PUBLIC_POSE_MODEL_URL into the app's document directory.
 * See scripts/download-models.sh and README › Pose model.
 */
export const POSE_MODEL_URL = config.pose.modelUrl;
const MODEL_FILE = 'movenet_singlepose_thunder.tflite';

export type PoseModelState =
  | { state: 'unavailable'; reason: string }
  | { state: 'loading' }
  | { state: 'ready'; model: TensorflowModel; inputSize: number; inputType: 'uint8' | 'float32' };

let cached: Promise<PoseModelState> | null = null;

export function getPoseModel(): Promise<PoseModelState> {
  if (!cached) cached = load();
  return cached;
}

async function ensureModelFile(): Promise<File | null> {
  if (!POSE_MODEL_URL) return null;
  const dir = new Directory(Paths.document, 'models');
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, MODEL_FILE);
  if (file.exists && (file.size ?? 0) > 1_000_000) return file;
  if (file.exists) file.delete();
  await File.downloadFileAsync(POSE_MODEL_URL, file);
  return file.exists ? file : null;
}

async function load(): Promise<PoseModelState> {
  if (Platform.OS === 'web') return { state: 'unavailable', reason: 'web' };
  try {
    const file = await ensureModelFile();
    if (!file) return { state: 'unavailable', reason: 'EXPO_PUBLIC_POSE_MODEL_URL not set' };
    const delegates = Platform.OS === 'ios' ? (['core-ml'] as const) : (['android-gpu'] as const);
    let model: TensorflowModel;
    try {
      model = await loadTensorflowModel({ url: file.uri }, [...delegates]);
    } catch {
      model = await loadTensorflowModel({ url: file.uri }, []);
    }
    const input = model.inputs[0];
    const size = input?.shape?.[1] ?? 256;
    const inputType = input?.dataType === 'float32' ? 'float32' : 'uint8';
    return { state: 'ready', model, inputSize: size, inputType };
  } catch (e) {
    return { state: 'unavailable', reason: (e as Error).message };
  }
}

/** Parse MoveNet output [1,1,17,3] (y, x, score) into our keypoint record. Pure; unit-tested. */
export function decodeMoveNetOutput(buf: Float32Array): { x: number; y: number; score: number }[] {
  const out: { x: number; y: number; score: number }[] = [];
  for (let i = 0; i < 17; i++) {
    out.push({ y: buf[i * 3] ?? 0, x: buf[i * 3 + 1] ?? 0, score: buf[i * 3 + 2] ?? 0 });
  }
  return out;
}
