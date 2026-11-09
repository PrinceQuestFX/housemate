"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { adminClient } from "@/lib/supabase/admin";

async function adminCtx() {
  const ctx = await getContext();
  if (!ctx.isAdmin) throw new Error("forbidden");
  return ctx;
}
const id = (f: FormData) => String(f.get("id") ?? "");

export async function approveMember(f: FormData) {
  const ctx = await adminCtx();
  const a = adminClient();
  await a.from("household_members").upsert({ household_id: ctx.householdId, user_id: id(f), role: "member" });
  await a.from("activity_logs").insert({ household_id: ctx.householdId, actor_id: ctx.userId, action: "member.approved", entity: "member", entity_id: id(f), detail: {} });
  revalidatePath("/members");
}

export async function rejectMember(f: FormData) {
  await adminCtx();
  const a = adminClient();
  const { data } = await a.from("household_members").select("user_id").eq("user_id", id(f)).maybeSingle();
  if (!data) await a.auth.admin.deleteUser(id(f)); // jamais un membre existant
  revalidatePath("/members");
}

export async function setRole(f: FormData) {
  const ctx = await adminCtx();
  const role = f.get("role") === "admin" ? "admin" : "member";
  const a = adminClient();
  if (role === "member") {
    const { count } = await a.from("household_members").select("user_id", { count: "exact", head: true }).eq("household_id", ctx.householdId).eq("role", "admin");
    if ((count ?? 0) <= 1) return; // toujours au moins un administrateur
  }
  await a.from("household_members").update({ role }).eq("household_id", ctx.householdId).eq("user_id", id(f));
  await a.from("activity_logs").insert({ household_id: ctx.householdId, actor_id: ctx.userId, action: "member.role", entity: "member", entity_id: id(f), detail: { role } });
  revalidatePath("/members");
}

export async function changePassword(f: FormData) {
  const { supabase } = await getContext();
  const pw = String(f.get("password") ?? "");
  if (pw.length < 10 || pw !== String(f.get("confirm") ?? "")) redirect("/settings?pw=err");
  const { error } = await supabase.auth.updateUser({ password: pw });
  redirect(error ? "/settings?pw=err" : "/settings?pw=ok");
}
