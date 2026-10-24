# Pose model

`movenet_singlepose_thunder.tflite` is downloaded here by `npm run models:download` and is git-ignored.

- Input: `[1, 256, 256, 3]` (uint8 for int8 builds, float32 0–255 for float16 builds)
- Output: `[1, 1, 17, 3]` as `(y, x, score)` per COCO keypoint, normalised 0..1
- Keypoint order matches `JOINTS` in `src/features/pose/types.ts`

At runtime the app downloads the model from `EXPO_PUBLIC_POSE_MODEL_URL` into the document directory on first launch
(see `src/features/pose/model.ts`). To bundle it instead, place the file here and switch `loadTensorflowModel` to a
`require()`; Metro is already configured to treat `.tflite` as an asset.
