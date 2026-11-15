import { createHmac, timingSafeEqual } from "crypto";

/** Verifies Lemon Squeezy's `X-Signature` (hex HMAC-SHA256 of the raw body). */
export function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Maps a Lemon Squeezy subscription status to a plan change (null = leave as is, e.g. cancelled-but-still-paid). */
export function planForStatus(status: string | undefined): "pro" | "free" | null {
  switch (status) {
    case "active":
    case "on_trial":
      return "pro";
    case "expired":
    case "unpaid":
    case "paused":
      return "free";
    default:
      return null; // cancelled (grace period until expiry), past_due (retrying), unknown
  }
}

/** Builds the checkout URL, attaching the user id so the webhook knows who paid. */
export function checkoutUrl(base: string, userId: string, email: string): string {
  const url = new URL(base);
  url.searchParams.set("checkout[email]", email);
  url.searchParams.set("checkout[custom][user_id]", userId);
  return url.toString();
}
