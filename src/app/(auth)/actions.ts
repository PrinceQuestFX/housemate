"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function login(f: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: str(f, "email"), password: String(f.get("password") ?? "") });
  if (error) redirect("/login?error=1");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestReset(f: FormData) {
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  await supabase.auth.resetPasswordForEmail(str(f, "email"), { redirectTo: `${site}/auth/callback?next=/reset/update` });
  redirect("/reset?sent=1"); // même réponse que l'e-mail existe ou non
}

export async function updatePassword(f: FormData) {
  const password = String(f.get("password") ?? "");
  if (password.length < 10) redirect("/reset/update?error=1");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/reset/update?error=1");
  redirect("/dashboard");
}
