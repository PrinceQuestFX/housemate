import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Mis en cache par requête : le layout et la page partagent le même contexte.
 * Un seul aller-retour vers Supabase (appartenance, membres, noms et alertes en parallèle),
 * au lieu de 4 appels l'un après l'autre.
 */
export const getContext = cache(async () => {
  const t0 = Date.now();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const t1 = Date.now();
  const [{ data: ms }, { data: ps }, { count }] = await Promise.all([
    supabase.from("household_members").select("household_id, user_id, role"),
    supabase.from("profiles").select("id, first_name, last_name"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
  ]);
  console.log(`[perf] getContext claims=${t1 - t0}ms data=${Date.now() - t1}ms`); // visible dans Vercel > Logs
  const me = ms?.find((m) => m.user_id === userId);
  if (!me) redirect("/attente"); // compte créé, en attente de validation
  const members = (ms ?? [])
    .filter((m) => m.household_id === me.household_id)
    .map((m) => {
      const p = ps?.find((x) => x.id === m.user_id);
      const name = p ? `${p.first_name} ${p.last_name}`.trim() : "";
      return { id: m.user_id as string, role: m.role as string, name: name || "Membre" };
    });
  return { supabase, userId, householdId: me.household_id as string, isAdmin: me.role === "admin", members, unread: count ?? 0 };
});

export type Ctx = Awaited<ReturnType<typeof getContext>>;

/** Déjà chargés par getContext : aucun appel supplémentaire. */
export async function loadMembers(ctx: Ctx) {
  return ctx.members;
}

/** Période "AAAA-MM" dans le fuseau de la maison. */
export const currentPeriod = (): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
