import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { planForStatus, verifySignature } from "@/lib/billing";

export const runtime = "nodejs";

interface LemonPayload {
  meta?: { event_name?: string; custom_data?: { user_id?: string } };
  data?: { attributes?: { status?: string } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const admin = createAdminClient();
  if (!secret || !admin) {
    return NextResponse.json({ error: "Billing webhook not configured." }, { status: 503 });
  }

  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: LemonPayload;
  try {
    payload = JSON.parse(raw) as LemonPayload;
  } catch {
    return NextResponse.json({ error: "Bad JSON." }, { status: 400 });
  }

  const event = payload.meta?.event_name ?? "";
  const userId = payload.meta?.custom_data?.user_id;
  if (!event.startsWith("subscription_") || !userId || !UUID.test(userId)) {
    return NextResponse.json({ ok: true, ignored: true }); // ack events we don't act on
  }

  const plan = planForStatus(payload.data?.attributes?.status);
  if (plan) {
    const { error } = await admin.from("profiles").update({ plan }).eq("id", userId);
    if (error) {
      console.error("[lemonsqueezy] plan update failed:", error.message);
      return NextResponse.json({ error: "DB error." }, { status: 500 }); // non-2xx makes Lemon Squeezy retry
    }
  }
  return NextResponse.json({ ok: true, plan });
}
