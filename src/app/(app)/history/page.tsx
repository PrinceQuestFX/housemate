import { getContext, loadMembers } from "@/lib/session";
import { fmt } from "@/lib/money";
import { TRANSFER_STATUS } from "@/lib/labels";
import { Empty, card } from "@/components/ui";

export default async function HistoryPage() {
  const ctx = await getContext();
  const members = await loadMembers(ctx);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "—";
  const [{ data: pts }, { data: tr }, { data: logs }] = await Promise.all([
    ctx.supabase.from("point_transactions").select("id, user_id, kind, delta, reason, period, created_at").eq("household_id", ctx.householdId).order("created_at", { ascending: false }).limit(50),
    ctx.supabase.from("money_transfers").select("id, from_user, to_user, amount_minor, status, created_at").eq("household_id", ctx.householdId).order("created_at", { ascending: false }).limit(50),
    ctx.isAdmin
      ? ctx.supabase.from("activity_logs").select("id, actor_id, action, created_at").eq("household_id", ctx.householdId).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] as { id: number; actor_id: string | null; action: string; created_at: string }[] }),
  ]);
  const d = (s: string) => new Date(s).toLocaleDateString("fr-MA");

  return (
    <>
      <h1 className="text-2xl font-semibold">Historique</h1>
      <section className="space-y-2"><h2 className="font-medium">Points</h2>
        {!pts?.length && <Empty>Aucun mouvement de points.</Empty>}
        {pts?.map((p) => <p key={p.id} className={`${card} text-sm`}>{d(p.created_at)} · {name(p.user_id)} · {p.delta > 0 ? "+" : ""}{p.delta} ({p.kind === "reversal" ? "annulation" : "sanction"}) {p.reason ? `· ${p.reason}` : ""}</p>)}
      </section>
      <section className="space-y-2"><h2 className="font-medium">Remises d'argent</h2>
        {!tr?.length && <Empty>Aucune remise.</Empty>}
        {tr?.map((t) => <p key={t.id} className={`${card} text-sm`}>{d(t.created_at)} · {name(t.from_user)} → {name(t.to_user)} · {fmt(Number(t.amount_minor))} · {TRANSFER_STATUS[t.status]}</p>)}
      </section>
      {ctx.isAdmin && (
        <section className="space-y-2"><h2 className="font-medium">Journal d'administration</h2>
          {!logs?.length && <Empty>Aucune action enregistrée.</Empty>}
          {logs?.map((l) => <p key={l.id} className={`${card} text-sm`}>{d(l.created_at)} · {l.actor_id ? name(l.actor_id) : "système"} · {l.action}</p>)}
        </section>
      )}
    </>
  );
}
