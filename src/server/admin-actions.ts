"use server";

import { randomBytes } from "node:crypto";
import { getContext } from "@/lib/session";
import { adminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type AddMemberState = { ok?: boolean; message?: string; password?: string };

/** Invitation : seuls les administrateurs créent des comptes ; le rôle créé est toujours « membre ». */
export async function addMember(_: AddMemberState, f: FormData): Promise<AddMemberState> {
  const ctx = await getContext();
  if (!ctx.isAdmin) return { message: "Réservé aux administrateurs." };

  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const first = String(f.get("first") ?? "").trim();
  const last = String(f.get("last") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !first) return { message: "Informations invalides." };

  const admin = adminClient();
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return { message: "Création impossible (adresse déjà utilisée ?)." };

  await admin.from("profiles").upsert({ id: data.user.id, first_name: first, last_name: last });
  const { error: e2 } = await admin.from("household_members").insert({ household_id: ctx.householdId, user_id: data.user.id, role: "member" });
  if (e2) return { message: "Compte créé mais rattachement à la maison impossible." };
  await admin.from("activity_logs").insert({
    household_id: ctx.householdId, actor_id: ctx.userId, action: "member.added", entity: "member", entity_id: data.user.id, detail: { email },
  });
  revalidatePath("/members");
  return { ok: true, password };
}
