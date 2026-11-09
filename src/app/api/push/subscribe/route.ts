import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const valid = typeof b?.endpoint === "string" && b.endpoint.startsWith("https://") && typeof b?.keys?.p256dh === "string" && typeof b?.keys?.auth === "string";
  if (!valid) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { error } = await supabase.rpc("rpc_save_push_subscription", { p_endpoint: b.endpoint, p_p256dh: b.keys.p256dh, p_auth_key: b.keys.auth });
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
