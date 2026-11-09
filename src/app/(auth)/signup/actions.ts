"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const digest = (s: string) => createHash("sha256").update(s).digest();

/**
 * Inscription libre protégée par le « code de la maison » (HOUSE_JOIN_CODE).
 * - Sans HOUSE_JOIN_CODE, les inscriptions sont fermées.
 * - Le rôle créé est toujours « membre » ; la maison est limitée à HOUSE_MAX_MEMBERS (5 par défaut).
 * - Le compte est créé côté serveur : « Allow new users to sign up » peut rester désactivé dans Supabase.
 */
export async function signUp(f: FormData) {
  const joinCode = process.env.HOUSE_JOIN_CODE;
  if (!joinCode) redirect("/signup?error=closed");

  const first = str(f, "first");
  const last = str(f, "last");
  const email = str(f, "email").toLowerCase();
  const password = String(f.get("password") ?? "");
  const code = str(f, "code");

  if (!timingSafeEqual(digest(code), digest(joinCode))) redirect("/signup?error=code");
  if (!first || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/signup?error=invalid");
  if (password.length < 10) redirect("/signup?error=password");

  const admin = adminClient();
  const { data: houses } = await admin.from("households").select("id").limit(1);
  const householdId = houses?.[0]?.id as string | undefined;
  if (!householdId) redirect("/signup?error=setup");

  const max = Number(process.env.HOUSE_MAX_MEMBERS ?? 5);
  const { count } = await admin
    .from("household_members")
    .select("user_id", { count: "exact", head: true })
    .eq("household_id", householdId);
  if ((count ?? 0) >= max) redirect("/signup?error=full");

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) redirect("/signup?error=exists");
  const userId = data.user.id;

  await admin.from("profiles").upsert({ id: userId, first_name: first, last_name: last });
  const { error: e2 } = await admin
    .from("household_members")
    .insert({ household_id: householdId, user_id: userId, role: "member" });
  if (e2) {
    await admin.auth.admin.deleteUser(userId);
    redirect("/signup?error=setup");
  }
  await admin.from("activity_logs").insert({
    household_id: householdId, actor_id: userId, action: "member.joined", entity: "member", entity_id: userId, detail: { email },
  });

  const supabase = await createClient();
  const { error: e3 } = await supabase.auth.signInWithPassword({ email, password });
  redirect(e3 ? "/login" : "/dashboard");
}
