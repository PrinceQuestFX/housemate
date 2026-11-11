import { SubmitButton } from "@/components/submit-button";
import Link from "next/link";
import { getContext, loadMembers, currentPeriod } from "@/lib/session";
import { reportInfraction } from "@/server/actions";
import { INFRACTION_STATUS, ROOMS } from "@/lib/labels";
import { SANCTION_POINTS, monthlyScore } from "@/domain/rules";
import { AiAnalyze } from "@/components/ai-analyze";
import { Badge, Empty, Field, btn, card, input } from "@/components/ui";

export default async function DisciplinePage() {
  const ctx = await getContext();
  const members = await loadMembers(ctx);
  const names = new Map(members.map((m) => [m.id, m.name]));
  const [{ data: pts }, { data: list }] = await Promise.all([
    ctx.supabase.from("point_transactions").select("user_id, delta").eq("household_id", ctx.householdId).eq("period", currentPeriod()),
    ctx.supabase.from("infractions").select("id, room, status, accused_id, points, proposed_points, created_at")
      .eq("household_id", ctx.householdId).order("created_at", { ascending: false }).limit(50),
  ]);
  const ranking = members
    .map((m) => ({ ...m, score: monthlyScore((pts ?? []).filter((p) => p.user_id === m.id).map((p) => p.delta)) }))
    .sort((a, b) => b.score - a.score);

  return (
    <>
      <h1 className="text-2xl font-semibold">Discipline</h1>
      <section className={card} aria-label="Classement du mois">
        <h2 className="mb-2 font-medium">Classement du mois</h2>
        <ol className="space-y-1 text-sm">
          {ranking.map((m, i) => (
            <li key={m.id} className="flex justify-between"><span>{i + 1}. {m.name}</span><span>{m.score} pts</span></li>
          ))}
        </ol>
      </section>

      <details className={card}>
        <summary className="cursor-pointer font-medium">Signaler un problème</summary>
        <form action={reportInfraction} className="mt-4 space-y-3">
          <Field label="Pièce">
            <select name="room" required className={input}>{Object.entries(ROOMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Field>
          <Field label="Membre concerné">
            <select name="accused" required className={input}><option value="">Choisir…</option>
              {members.filter((m) => m.id !== ctx.userId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Points à retirer (la maison vote)">
            <select name="points" required className={input}>{SANCTION_POINTS.map((n) => <option key={n} value={n}>-{n} points</option>)}</select>
          </Field>
          <Field label="Description"><textarea name="description" required rows={3} className={input} /></Field>
          <Field label="Photo (4 Mo max)"><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className={input} /></Field>
          <AiAnalyze />
          <SubmitButton className={btn}>Envoyer le signalement</SubmitButton>
        </form>
      </details>

      <section className="space-y-2">
        <h2 className="font-medium">Signalements</h2>
        {!list?.length && <Empty>Aucun signalement pour le moment.</Empty>}
        {list?.map((i) => (
          <Link key={i.id} href={`/discipline/${i.id}`} className={`${card} flex items-center justify-between`}>
            <span className="text-sm">{ROOMS[i.room]}{i.accused_id ? ` · ${names.get(i.accused_id)}` : ""}{i.points ?? i.proposed_points ? ` · -${i.points ?? i.proposed_points}` : ""}</span>
            <Badge>{INFRACTION_STATUS[i.status]}</Badge>
          </Link>
        ))}
      </section>
    </>
  );
}
