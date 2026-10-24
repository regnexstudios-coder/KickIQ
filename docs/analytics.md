# Analytics events (PostHog)

| Event | When | Properties |
| --- | --- | --- |
| `onboarding_step` | Each quiz screen view | `step` |
| `paywall_view` | Paywall shown | `variant` (A/B), `mode` (revenuecat/mock) |
| `trial_start` | Purchase completed | `plan`, `price`, `variant` |
| `restore_purchases` | Restore tapped | `ok` |
| `analysis_start` | "Rate this kick" tapped | `source`, `frames`, `retake` |
| `analysis_complete` | Validated result saved | `kick_type`, `rating`, `confidence`, `has_metrics`, `source`, `retake` |
| `analysis_retry` | Model returned `retry_reason` | `reason` |
| `analysis_error` | Pipeline failed | `message` |
| `share_card` | Score card share sheet | `rating`, `ok` |
| `challenge_share` | "Challenge a friend" text share | `ok` |
| `retake` | Retake tapped on a result | `from` |
| `age_gate_blocked` | DOB under 13 | `age` |
| `referral_redeem` | Code redeemed | `ok` |
| `weekly_challenge_enter` | Rating submitted to the weekly board | `score` |
| `delete_data` | "Delete my data" confirmed | – |

Paywall A/B: `variant` is assigned once per install (`useProfileStore.paywallVariant`). A animates 58→86, B animates 61→89. Compare `trial_start` / `paywall_view` by variant.
