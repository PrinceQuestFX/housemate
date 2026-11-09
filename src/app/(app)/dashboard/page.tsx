import Link from "next/link";
import { getContext, currentPeriod } from "@/lib/session";
import { monthlyScore, earnsMonthlyCongratulations } from "@/domain/rules";
import { fmt } from "@/lib/money";
import { card } from "@/components/ui";

export default async function Dashboard() {
  const { supabase, userId, householdId, isAdmin } = await getContext();
  const [pts, bal, mine, toVerify, pending, contests] = await Promise.all([
    supabase.from("point_transactions").select("delta").eq("user_id", userId).eq("period", currentPeriod()),
    supabase.from("member_balances").select("balance_minor").eq("user_id", userId).eq("household_id", householdId).single(),
    supabase.from("cleaning_assignments").select("id", { count: "exact", head: true }).eq("assignee_id", userId).in("status", ["todo", "to_fix"]),
    supabase.from("cleaning_assignments").select("id", { count: "exact", head: true }).eq("status", "to_verify").neq("assignee_id", userId),
    supabase.from("infractions").select("id", { count: "exact", head: true }).in("status", ["pending", "reviewing"]),
    supabase.from("money_transfers").select("id", { count: "exact", head: true }).eq("to_user", userId).eq("status", "pending"),
  ]);
  const score = monthlyScore((pts.data ?? []).map((p) => p.delta));
  const balance = Number(bal.data?.balance_minor ?? 0);

  const tiles: [string, string, string][] = [
    ["Score du mois", `${score} / 200`, "/discipline"],
    ["Solde", `${balance >= 0 ? "+" : ""}${fmt(balance)}`, "/finance"],
    ["Mes tâches", String(mine.count ?? 0), "/cleaning"],
    ["À vérifier", String(toVerify.count ?? 0), "/cleaning"],
    ["Remises à confirmer", String(contests.count ?? 0), "/finance"],
    ...(isAdmin ? ([["Signalements en attente", String(pending.count ?? 0), "/discipline"]] as [string, string, string][]) : []),
  ];

  return (
    <>
      <h1 className="text-2xl font-semibold">Tableau de bord</h1>
      {earnsMonthlyCongratulations(score) && <p className={`${card} bg-emerald-50 dark:bg-emerald-950`}>Bravo, 200 points sur le mois.</p>}
      <ul className="grid grid-cols-2 gap-3">
        {tiles.map(([label, value, href]) => (
          <li key={label}>
            <Link href={href} className={`${card} block`}>
              <span className="text-xs text-neutral-500">{label}</span>
              <span className="block text-xl font-semibold">{value}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
