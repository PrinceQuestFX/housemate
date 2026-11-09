import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import * as webpush from "web-push";
import { adminClient } from "@/lib/supabase/admin";
import { NOTIFICATION_KINDS } from "@/lib/labels";

export const runtime = "nodejs";

// Appelé par un Database Webhook Supabase (INSERT sur public.notifications).
export async function POST(req: Request) {
  const secret = Buffer.from(process.env.PUSH_WEBHOOK_SECRET ?? "");
  const given = Buffer.from(req.headers.get("x-webhook-secret") ?? "");
  if (!secret.length || secret.length !== given.length || !timingSafeEqual(secret, given)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { record } = await req.json();
  if (!record?.user_id) return NextResponse.json({ ok: true });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const admin = adminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth_key").eq("user_id", record.user_id);
  const payload = JSON.stringify({ title: "HOUSEMATE", body: NOTIFICATION_KINDS[record.kind] ?? "Nouvelle notification", url: "/notifications" });

  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }));
  return NextResponse.json({ ok: true });
}
