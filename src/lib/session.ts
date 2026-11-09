import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Mis en cache par requête : le layout et la page partagent la même vérification (moins d'allers-retours vers Supabase). */
export const getContext = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const { data: m } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!m) redirect("/attente"); // compte créé, en attente de validation
  return { supabase, userId, householdId: m.household_id as string, isAdmin: m.role === "admin" };
});

export type Ctx = Awaited<ReturnType<typeof getContext>>;

export async function loadMembers(ctx: Ctx) {
  const { data: ms } = await ctx.supabase
    .from("household_members")
    .select("user_id, role")
    .eq("household_id", ctx.householdId);
  const ids = (ms ?? []).map((m) => m.user_id);
  const { data: ps } = await ctx.supabase.from("profiles").select("id, first_name, last_name").in("id", ids);
  return (ms ?? []).map((m) => {
    const p = ps?.find((x) => x.id === m.user_id);
    const name = p ? `${p.first_name} ${p.last_name}`.trim() : "";
    return { id: m.user_id as string, role: m.role as string, name: name || "Membre" };
  });
}

/** Période "AAAA-MM" dans le fuseau de la maison. */
export const currentPeriod = (): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
