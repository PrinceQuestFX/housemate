import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const PROMPT =
  'Tu analyses la photo d\'un espace commun d\'une colocation. Réponds uniquement en JSON : {"description": "...", "problems": ["..."], "category": "vaisselle|poubelles|saleté|désordre|autre", "indicative_severity": "léger|moyen|grave"}. Décris objectivement ce qui est visible, sans accuser personne. Tu ne décides d\'aucune sanction.';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: m } = await supabase.from("household_members").select("household_id").eq("user_id", data.claims.sub).limit(1).maybeSingle();
  if (!m) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const file = (await req.formData()).get("photo");
  if (!(file instanceof File) || !TYPES.includes(file.type) || file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "invalid_photo" }, { status: 400 });
  }
  if (process.env.AI_PROVIDER !== "anthropic" || !process.env.AI_API_KEY || !process.env.AI_MODEL) {
    return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
  }

  const { error } = await supabase.rpc("rpc_reserve_ai_analysis", { p_household: m.household_id });
  if (error) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.AI_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: file.type, data: Buffer.from(await file.arrayBuffer()).toString("base64") } },
        { type: "text", text: PROMPT },
      ] }],
    }),
  });
  if (!res.ok) return NextResponse.json({ error: "ai_failed" }, { status: 502 });

  const body = await res.json();
  const text: string = body.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
  try {
    return NextResponse.json(JSON.parse(text.replace(/```json|```/g, "").trim()));
  } catch {
    return NextResponse.json({ description: text, problems: [], category: "autre", indicative_severity: null });
  }
}
