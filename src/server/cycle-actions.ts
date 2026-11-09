"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Cycle de 15 jours : 5 personnes, une journée de ménage chacune tous les 3 jours (jours 1, 4, 7, 10, 13). */
export async function generateCycle(f: FormData) {
  const ctx = await getContext();
  if (!ctx.isAdmin) redirect("/cleaning");
  const start = Date.parse(`${f.get("start")}T00:00:00Z`);
  const order = [0, 1, 2, 3, 4].map((i) => String(f.get(`s${i}`) ?? ""));
  if (Number.isNaN(start) || order.some((x) => !x)) redirect("/cleaning?cycle=err");
  const cycles = Math.min(3, Math.max(1, Number(f.get("cycles")) || 1));
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Casablanca" }).format(new Date());

  const { data: ex } = await ctx.supabase.from("cleaning_assignments").select("assignee_id, due_on").eq("household_id", ctx.householdId);
  const known = new Set((ex ?? []).map((e) => `${e.assignee_id}|${e.due_on}`));

  let n = 0;
  for (let c = 0; c < cycles; c++) {
    for (let i = 0; i < 5; i++) {
      const due = iso(start + (c * 15 + i * 3) * DAY);
      if (due < today || known.has(`${order[i]}|${due}`)) continue; // ni le passé, ni les doublons
      const { error } = await ctx.supabase.rpc("rpc_create_cleaning", { p_household: ctx.householdId, p_title: "Ménage", p_room: null, p_assignee: order[i], p_due: due });
      if (error) throw new Error(error.message);
      n++;
    }
  }
  revalidatePath("/cleaning");
  redirect(`/cleaning?cycle=${n}`);
}
