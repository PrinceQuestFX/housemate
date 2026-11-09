import { loadMembers, type Ctx } from "@/lib/session";
import { MONTHLY_CAPITAL } from "@/domain/rules";

export const isPeriod = (p: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p);

function bounds(period: string) {
  const [y, m] = period.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start: `${period}-01`, end: `${next}-01` };
}

export async function loadReport(ctx: Ctx, period: string) {
  const { start, end } = bounds(period);
  const members = await loadMembers(ctx);
  const [{ data: pts }, { data: exp }, { data: validated }, { data: cleaning }] = await Promise.all([
    ctx.supabase.from("point_transactions").select("user_id, delta").eq("household_id", ctx.householdId).eq("period", period),
    ctx.supabase.from("expenses").select("title, amount_minor, category, spent_on, paid_by").eq("household_id", ctx.householdId).gte("spent_on", start).lt("spent_on", end),
    ctx.supabase.from("infractions").select("id").eq("household_id", ctx.householdId).eq("status", "validated").gte("decided_at", start).lt("decided_at", end),
    ctx.supabase.from("cleaning_assignments").select("status").eq("household_id", ctx.householdId).gte("due_on", start).lt("due_on", end),
  ]);

  const scores = members
    .map((m) => {
      const delta = (pts ?? []).filter((p) => p.user_id === m.id).reduce((s, p) => s + p.delta, 0);
      return { name: m.name, start: MONTHLY_CAPITAL, lost: -Math.min(0, delta), final: MONTHLY_CAPITAL + delta };
    })
    .sort((a, b) => b.final - a.final);

  const byCategory: Record<string, number> = {};
  for (const e of exp ?? []) byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount_minor);
  const total = Object.values(byCategory).reduce((a, b) => a + b, 0);

  return {
    scores, byCategory, total, expenses: exp ?? [], members,
    infractions: validated?.length ?? 0,
    tasksDone: (cleaning ?? []).filter((c) => c.status === "validated").length,
    tasksTotal: cleaning?.length ?? 0,
  };
}
