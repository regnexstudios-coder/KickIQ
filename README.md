# KickIQ

AI soccer kick coach for players 13–18. Film one kick, get a shareable **Kick Rating (0–100)**, one fix, and three drills.

- **App:** Expo SDK 58 (React Native 0.88) · TypeScript · Expo Router · NativeWind · Zustand
- **Pose:** on-device, VisionCamera 4 frame processor + MoveNet Thunder via `react-native-fast-tflite`
- **Coach:** Google Gemini (strict JSON, validated with Zod), proxied by a Supabase Edge Function in production
- **Backend:** Supabase (anonymous auth, Postgres with RLS, storage for score cards only)
- **Payments:** RevenueCat · **Analytics:** PostHog

Raw video never leaves the device. Only six JPEG key frames and the metrics JSON are sent for scoring.

---

## 1. Setup

```bash
git clone https://github.com/regnexstudios-coder/KickIQ && cd KickIQ
npm install
cp .env.example .env            # fill in keys (see below) — the app also runs with none
npm run models:download         # MoveNet .tflite (see "Pose model" if Kaggle needs a login)
npx expo prebuild               # generates ios/ and android/ (never edit them by hand)
npx expo run:ios                # or: npx expo run:android
```

This app uses native modules (camera, TFLite, purchases) so it **does not run in Expo Go**. Use a dev build:
`npx expo run:ios|android` locally, or `eas build --profile development`.

### Quality checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (expo flat config + React Compiler rules)
npm test            # jest: pose metrics, phase detection, JSON schema, stores, i18n
npm run doctor      # expo-doctor
```

## 2. Environment variables

All client values are `EXPO_PUBLIC_*` (Expo inlines them at build time). Every integration degrades gracefully when its key is missing, so you can run the UI end-to-end with an empty `.env`:

| Variable | Purpose | If missing |
| --- | --- | --- |
| `EXPO_PUBLIC_GEMINI_API_KEY` | **Dev only.** Direct Gemini calls from the app | Offline mock coach |
| `EXPO_PUBLIC_GEMINI_MODEL` | Default `gemini-2.5-flash` | – |
| `EXPO_PUBLIC_ANALYZE_ENDPOINT` | **Production.** URL of the `analyze-kick` Edge Function (holds the Gemini key server-side) | Falls back to the key above, then mock |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anonymous auth, history sync, leaderboard, referrals | Local-only storage |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | Paywall & entitlements | Local test subscription (paywall shows a notice) |
| `EXPO_PUBLIC_POSTHOG_KEY` / `EXPO_PUBLIC_POSTHOG_HOST` | Analytics | Events logged to console in dev |
| `EXPO_PUBLIC_POSE_MODEL_URL` | Where the app downloads the MoveNet `.tflite` on first run | No on-device metrics; coach scores from key frames |
| `EXPO_PUBLIC_APP_STORE_URL` / `EXPO_PUBLIC_PLAY_STORE_URL` / `EXPO_PUBLIC_SUPPORT_EMAIL` | Links on the share card and in Settings | Defaults to kickiq.app |

> Never ship `EXPO_PUBLIC_GEMINI_API_KEY` in a store build. Deploy the Edge Function and set `EXPO_PUBLIC_ANALYZE_ENDPOINT` instead.

## 3. Backend (Supabase)

The production project already exists: **`kickiq`** (ref `tbelctibljtsejkvwrqn`, eu-west-1). The schema in
`supabase/migrations/0001_init.sql` is applied and the `analyze-kick` Edge Function is deployed with JWT verification.
`.env.example` carries the project URL, publishable key and function URL.

Still manual (dashboard):
1. **Authentication → Sign In / Providers → enable "Anonymous sign-ins"** (the app has no email/password flow).
2. **Edge Functions → Secrets → add `GEMINI_API_KEY`** (and optionally `GEMINI_MODEL`). Until it is set the function
   returns 500 "server not configured" and the app falls back to the mock coach.

To recreate the backend elsewhere:

```bash
supabase link --project-ref <ref>
supabase db push                                   # applies supabase/migrations/0001_init.sql
supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=gemini-2.5-flash
supabase functions deploy analyze-kick             # JWT required; anonymous users are fine
```

Then set `EXPO_PUBLIC_ANALYZE_ENDPOINT=https://<ref>.supabase.co/functions/v1/analyze-kick`.

Tables: `profiles`, `analyses`, `streaks`, `challenge_entries`, `referral_redemptions` (+ `weekly_leaderboard` view, `redeem_referral()` RPC, private `score-cards` bucket). Row-level security restricts every table to the owner. Enable **Anonymous sign-ins** under Authentication → Providers.

## 4. Pose model

The app runs MoveNet SinglePose Thunder (17 COCO keypoints) at ~12 fps in a VisionCamera frame processor while you record, then computes the §4 metrics (plant-foot distance/angle, knee-over-ball, hip/shoulder rotation, torso lean, backswing, follow-through, approach angle/steps, head position) in pure TypeScript (`src/features/pose/metrics.ts`, unit-tested with a synthetic kick).

Get the model with `npm run models:download` (Kaggle may require a login; the script prints manual steps). Host it on a public bucket and set `EXPO_PUBLIC_POSE_MODEL_URL`, or bundle it per `assets/models/README.md`.

Design notes / assumptions:
- Ball position is estimated as the kicking ankle at contact (no ball detector in v1). Distances use leg length ≈ 53 % of height; players can set height in Settings.
- Imported clips have no live frames, so they skip on-device metrics; Gemini scores from six sampled key frames with lower confidence.
- Swapping to a 33-landmark MediaPipe model only requires mapping landmark names onto `JOINTS` in `src/features/pose/types.ts`.

## 5. Project layout

```
src/app/                 Expo Router routes (age-gate → onboarding/[step] → paywall → (tabs) → record/* → analyzing → result/[id])
src/components/          UI primitives (ui/), ScoreRing, SubScoreBar, SkeletonOverlay, ScoreCard (9:16 share), LineChart
src/features/pose/       model loader, live frame processor hook, phases, metrics, synthetic mock
src/features/analysis/   Zod schema, Gemini prompt + client, pipeline orchestrator, offline mock coach
src/features/billing/    RevenueCat wrapper with mock store fallback
src/features/auth|history|challenge|referral|share|analytics
src/store/               Zustand stores (profile, history, streak, subscription, challenge, session)
src/i18n/                en.ts (all strings), es.ts (partial), t()
supabase/                SQL migration + analyze-kick Edge Function
docs/                    privacy, terms, store listing, analytics events
assets/store/            App Store screenshots (generated)
```

## 6. Release (EAS → TestFlight)

1. `npm i -g eas-cli && eas login && eas init` — paste the project id into `app.json › extra.eas.projectId`.
2. Fill `eas.json › submit.production` (Apple ID, ASC app id, team id; Play service-account JSON).
3. Create products in App Store Connect / Play Console and RevenueCat: `kickiq_pro_weekly` ($3.99/wk), `kickiq_pro_annual` ($49.99/yr), `kickiq_family_annual` ($69.99/yr), each with a 3-day free trial, attached to entitlement `pro` in the **default offering**.
4. Add secrets: `eas secret:create --scope project --name EXPO_PUBLIC_ANALYZE_ENDPOINT --value ...` (repeat for Supabase, RevenueCat, PostHog, pose model URL).
5. Build: `npm run build:ios` / `npm run build:android`.
6. Submit: `npm run submit:ios` (→ TestFlight) · `eas submit -p android`.
7. Store listing copy, screenshot captions and privacy nutrition labels are in `docs/store-listing.md`.

## 7. Product rules enforced in code

- One-step input: no forms before the first result (quiz is one tap per screen, camera is two taps away from Home).
- Hard paywall after onboarding (`Stack.Protected` guards in `src/app/_layout.tsx`), 3-day trial, restore purchases.
- Age gate 13+; DOB kept in SecureStore, only birth year synced.
- Videos stay on device (`<documents>/clips`); only score cards can be uploaded, and only when shared.
- No public profiles or chat; leaderboard shows first name + initial.
- Retake loop with side-by-side compare (`/compare/[id]`).
- Every result exports a 9:16 PNG score card with "Rate my kick → KickIQ" and a `kickiq://rate` deep link.
