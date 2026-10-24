#!/usr/bin/env bash
# Downloads the MoveNet SinglePose Thunder TFLite model used for on-device pose tracking.
#
# The model is Apache-2.0 licensed by Google but is not committed to this repo. Two ways to ship it:
#   1. (default) Host the file somewhere public (e.g. a Supabase Storage public bucket) and set
#      EXPO_PUBLIC_POSE_MODEL_URL. The app downloads it once on first launch.
#   2. Bundle it: copy the file to assets/models/ and change src/features/pose/model.ts to
#      `loadTensorflowModel(require('@/assets/models/movenet_singlepose_thunder.tflite'))`.
#
# Kaggle (the current home of TF Hub models) requires a free account for direct downloads.
set -euo pipefail
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/assets/models"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/movenet_singlepose_thunder.tflite"

URL="${MOVENET_URL:-https://www.kaggle.com/models/google/movenet/tfLite/singlepose-thunder-tflite-float16/4/download}"

echo "Downloading MoveNet Thunder (float16) → $OUT"
if ! curl -fL --retry 3 -o "$OUT" "$URL"; then
  cat <<MSG
Download failed. Grab the model manually:
  1. Open https://www.kaggle.com/models/google/movenet/tfLite/singlepose-thunder-tflite-float16
  2. Download the .tflite (≈12 MB) and save it as:
     $OUT
  3. Upload it to a public bucket and set EXPO_PUBLIC_POSE_MODEL_URL in .env,
     or bundle it as described at the top of this script.
MSG
  exit 1
fi

SIZE=$(wc -c < "$OUT")
if [ "$SIZE" -lt 1000000 ]; then
  echo "File looks too small ($SIZE bytes). Kaggle probably returned an HTML login page. See instructions above."
  rm -f "$OUT"
  exit 1
fi
echo "OK ($SIZE bytes). Expected tensors: input [1,256,256,3] uint8/float32, output [1,1,17,3] float32."
