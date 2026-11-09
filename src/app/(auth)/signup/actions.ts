"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/**
 * Inscription libre, sans code. Le compte ADMIN_EMAIL devient administrateur (et crée la maison)
 * tant qu'il n'y a aucun admin ; tous les autres attendent la validation d'un administrateur.
 */
export async function signUp(f: FormData) {
  const first = str(f, "first"), last = str(f, "last"), email = str(f, "email").toLowerCase();
  const password = String(f.get("password") ?? "");
  if (!first || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/signup?error=invalid");
  if (password.length < 10) redirect("/signup?error=password");

  const a = adminClient();
  let owner = false;
  if (email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
    const { count } = await a.from("household_members").select("user_id", { count: "exact", head: true }).eq("role", "admin");
    owner = (count ?? 0) === 0;
  }
  const { data, error } = await a.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) redirect("/signup?error=exists");
  await a.from("profiles").upsert({ id: data.user.id, first_name: first, last_name: last });

  if (owner) {
    const { data: hs } = await a.from("households").select("id").limit(1);
    let hid = hs?.[0]?.id as string | undefined;
    if (!hid) hid = (await a.from("households").insert({ name: "Maison" }).select("id").single()).data?.id;
    if (!hid) redirect("/signup?error=setup");
    await a.from("household_members").upsert({ household_id: hid, user_id: data.user.id, role: "admin" });
  }
  const supabase = await createClient();
  const { error: e3 } = await supabase.auth.signInWithPassword({ email, password });
  redirect(e3 ? "/login" : owner ? "/dashboard" : "/attente");
}
