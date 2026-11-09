"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { toMinor } from "@/lib/money";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const MAX_PHOTO = 4 * 1024 * 1024; // limite de requête Vercel ; compression côté client à prévoir

async function rpc(name: string, args: Record<string, unknown>) {
  const { supabase } = await getContext();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

async function uploadPhoto(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_PHOTO || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("invalid_photo");
  }
  const { supabase, userId, householdId } = await getContext();
  const path = `${householdId}/${userId}/${randomUUID()}.${file.type.split("/")[1]}`;
  const { error } = await supabase.storage.from("evidence").upload(path, file);
  if (error) throw new Error(error.message);
  return path;
}

// ---------- Discipline ----------
export async function reportInfraction(f: FormData) {
  const { householdId } = await getContext();
  const photo = await uploadPhoto(f.get("photo") as File | null);
  const id = await rpc("rpc_create_infraction", {
    p_household: householdId,
    p_accused: str(f, "accused") || null,
    p_room: str(f, "room"),
    p_description: str(f, "description"),
    p_photo: photo,
  });
  redirect(`/discipline/${id}`);
}

export async function decideInfraction(f: FormData) {
  const id = str(f, "id");
  await rpc("rpc_decide_infraction", {
    p_id: id,
    p_validate: str(f, "mode") === "validate",
    p_points: Number(str(f, "points")) || null,
    p_reason: str(f, "reason"),
  });
  revalidatePath(`/discipline/${id}`);
}

export async function reverseInfraction(f: FormData) {
  const id = str(f, "id");
  await rpc("rpc_reverse_infraction", { p_id: id, p_reason: str(f, "reason") });
  revalidatePath(`/discipline/${id}`);
  revalidatePath("/discipline");
  revalidatePath("/dashboard");
}

export async function contestInfraction(f: FormData) {
  const id = str(f, "id");
  await rpc("rpc_contest_infraction", { p_id: id, p_reason: str(f, "reason") });
  revalidatePath(`/discipline/${id}`);
}

export async function castVote(f: FormData) {
  await rpc("rpc_cast_vote", { p_contest: str(f, "contest"), p_vote: str(f, "vote") });
  revalidatePath(`/discipline/${str(f, "id")}`);
}

// ---------- Finances ----------
export async function createExpense(f: FormData) {
  const { householdId } = await getContext();
  await rpc("rpc_create_expense", {
    p_household: householdId,
    p_title: str(f, "title"),
    p_amount: toMinor(str(f, "amount")),
    p_category: str(f, "category"),
    p_date: str(f, "date") || new Date().toISOString().slice(0, 10),
    p_paid_by: str(f, "paid_by"),
    p_members: f.getAll("members").map(String),
    p_receipt: await uploadPhoto(f.get("receipt") as File | null),
    p_key: str(f, "key"),
  });
  revalidatePath("/finance");
}

export async function declareTransfer(f: FormData) {
  const { householdId } = await getContext();
  await rpc("rpc_declare_transfer", {
    p_household: householdId,
    p_to: str(f, "to"),
    p_amount: toMinor(str(f, "amount")),
    p_key: str(f, "key"),
  });
  revalidatePath("/finance");
}

export async function resolveTransfer(f: FormData) {
  await rpc("rpc_resolve_transfer", { p_id: str(f, "id"), p_accept: str(f, "accept") === "true" });
  revalidatePath("/finance");
}

// ---------- Nettoyage ----------
export async function assignCleaning(f: FormData) {
  const { householdId } = await getContext();
  await rpc("rpc_create_cleaning", {
    p_household: householdId,
    p_title: str(f, "title"),
    p_room: str(f, "room") || null,
    p_assignee: str(f, "assignee"),
    p_due: str(f, "due"),
  });
  revalidatePath("/cleaning");
}

export async function completeCleaning(f: FormData) {
  await rpc("rpc_complete_cleaning", { p_id: str(f, "id"), p_proof: await uploadPhoto(f.get("proof") as File | null) });
  revalidatePath("/cleaning");
}

export async function verifyCleaning(f: FormData) {
  await rpc("rpc_verify_cleaning", {
    p_id: str(f, "id"),
    p_accept: str(f, "accept") === "true",
    p_reason: str(f, "reason") || null,
  });
  revalidatePath("/cleaning");
}

// ---------- Notifications ----------
export async function markAllRead() {
  const { supabase, userId } = await getContext();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  revalidatePath("/notifications");
}

// ---------- Mur de la maison ----------
export async function postAnnouncement(f: FormData) {
  const { householdId } = await getContext();
  await rpc("rpc_post_announcement", {
    p_household: householdId,
    p_title: str(f, "title"),
    p_body: str(f, "body"),
    p_pin: str(f, "pin") === "on",
  });
  revalidatePath("/wall");
}

export async function setPinned(f: FormData) {
  await rpc("rpc_set_pinned", { p_id: str(f, "id"), p_pinned: str(f, "pinned") === "true" });
  revalidatePath("/wall");
}

export async function deleteAnnouncement(f: FormData) {
  await rpc("rpc_delete_announcement", { p_id: str(f, "id") });
  revalidatePath("/wall");
}

// ---------- Profil ----------
export async function saveProfile(f: FormData) {
  const { supabase, userId } = await getContext();
  const { error } = await supabase
    .from("profiles")
    .update({ first_name: str(f, "first"), last_name: str(f, "last"), phone: str(f, "phone") || null })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
