import { useEffect, useMemo, useState } from 'react';
import { runAtTargetFps, useFrameProcessor, type Frame } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import { getPoseModel, type PoseModelState } from './model';
import { JOINTS, type Joint, type Keypoint, type PoseFrame } from './types';

const TARGET_FPS = 12;

interface LiveSession {
  /** JS-thread sink that receives flattened keypoints from the frame-processor worklet. */
  sink: (flat: number[]) => Promise<void>;
  start: () => void;
  stop: () => PoseFrame[];
}

/** Collection state lives in a closure so React never sees (or re-renders on) per-frame mutation. */
function createLiveSession(onLatest: (f: PoseFrame) => void): LiveSession {
  let collecting = false;
  let startedAt = 0;
  let buffer: PoseFrame[] = [];
  let lastUi = 0;
  const sink = Worklets.createRunOnJS((flat: number[]) => {
    const now = Date.now();
    const keypoints = {} as Record<Joint, Keypoint>;
    for (let i = 0; i < JOINTS.length; i++) {
      keypoints[JOINTS[i]!] = { y: flat[i * 3] ?? 0, x: flat[i * 3 + 1] ?? 0, score: flat[i * 3 + 2] ?? 0 };
    }
    const frame: PoseFrame = { t: collecting ? (now - startedAt) / 1000 : 0, keypoints };
    if (collecting) buffer.push(frame);
    if (now - lastUi > 80) {
      lastUi = now;
      onLatest(frame);
    }
  });
  return {
    sink,
    start: () => {
      buffer = [];
      startedAt = Date.now();
      collecting = true;
    },
    stop: () => {
      collecting = false;
      const frames = buffer;
      buffer = [];
      return frames;
    },
  };
}

interface LivePose {
  /** Pass to <Camera frameProcessor={...} />. Undefined when the model is unavailable. */
  frameProcessor: ReturnType<typeof useFrameProcessor> | undefined;
  modelState: PoseModelState;
  /** Most recent frame for the overlay (throttled). */
  latest: PoseFrame | null;
  /** True when hips, knees and ankles are all confidently visible. */
  fullBodyVisible: boolean;
  /** Begin collecting frames (call when recording starts). */
  startCollecting: () => void;
  /** Stop and return the collected frames, timed from startCollecting(). */
  stopCollecting: () => PoseFrame[];
}

/**
 * Runs MoveNet on live camera frames (VisionCamera frame processor + fast-tflite),
 * decodes keypoints into normalised image space and streams them to JS.
 */
export function useLivePose(enabled: boolean): LivePose {
  const [modelState, setModelState] = useState<PoseModelState>({ state: 'loading' });
  const [latest, setLatest] = useState<PoseFrame | null>(null);
  const { resize } = useResizePlugin();
  const [session] = useState<LiveSession>(() => createLiveSession(setLatest));

  useEffect(() => {
    let alive = true;
    getPoseModel().then((s) => alive && setModelState(s));
    return () => {
      alive = false;
    };
  }, []);

  const onKeypoints = session.sink;

  const ready = modelState.state === 'ready' ? modelState : null;
  const model = ready?.model;
  const inputSize = ready?.inputSize ?? 256;
  const inputType = ready?.inputType ?? 'uint8';

  const frameProcessor = useFrameProcessor(
    (frame: Frame) => {
      'worklet';
      if (model == null || !enabled) return;
      runAtTargetFps(TARGET_FPS, () => {
        'worklet';
        const isLandscape = frame.orientation === 'landscape-left' || frame.orientation === 'landscape-right';
        const rotation = isLandscape ? (frame.orientation === 'landscape-left' ? '90deg' : '270deg') : '0deg';
        const resized = resize(frame, {
          scale: { width: inputSize, height: inputSize },
          pixelFormat: 'rgb',
          dataType: inputType,
          rotation,
        });
        let input: ArrayBuffer;
        if (inputType === 'float32') {
          // MoveNet float models expect 0..255 floats; the resize plugin yields 0..1.
          const f = resized as Float32Array;
          for (let i = 0; i < f.length; i++) f[i] = (f[i] ?? 0) * 255;
          input = f.buffer as ArrayBuffer;
        } else {
          input = (resized as Uint8Array).buffer as ArrayBuffer;
        }
        const outputs = model.runSync([input]);
        const out = new Float32Array(outputs[0] as ArrayBuffer);
        const flat: number[] = [];
        for (let i = 0; i < 51; i++) flat.push(out[i] ?? 0);
        onKeypoints(flat);
      });
    },
    [model, enabled, inputSize, inputType, resize, onKeypoints],
  );

  const startCollecting = session.start;
  const stopCollecting = session.stop;

  const fullBodyVisible = useMemo(() => {
    if (!latest) return false;
    const need: Joint[] = ['left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle', 'left_shoulder', 'right_shoulder'];
    return need.every((j) => latest.keypoints[j].score > 0.35);
  }, [latest]);

  return {
    frameProcessor: model ? frameProcessor : undefined,
    modelState,
    latest,
    fullBodyVisible,
    startCollecting,
    stopCollecting,
  };
}
