import { SubmitButton } from "@/components/submit-button";
import { notFound } from "next/navigation";
import { getContext, loadMembers } from "@/lib/session";
import { castVote, contestInfraction, decideInfraction } from "@/server/actions";
import { INFRACTION_STATUS, ROOMS } from "@/lib/labels";
import { SANCTION_POINTS } from "@/domain/rules";
import { Badge, Field, btn, btnDanger, btnGhost, card, input } from "@/components/ui";

export default async function InfractionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  const { data: inf } = await ctx.supabase.from("infractions").select("*").eq("id", id).maybeSingle();
  if (!inf) notFound();

  const members = await loadMembers(ctx);
  const name = (uid: string | null) => members.find((m) => m.id === uid)?.name ?? "—";
  const { data: ev } = await ctx.supabase.from("infraction_evidence").select("storage_path").eq("infraction_id", id);
  const photos = await Promise.all(
    (ev ?? []).map(async (e) => (await ctx.supabase.storage.from("evidence").createSignedUrl(e.storage_path, 3600)).data?.signedUrl),
  );
  const { data: contest } = await ctx.supabase.from("infraction_contests").select("id, outcome, reason").eq("infraction_id", id).maybeSingle();
  const { data: votes } = contest
    ? await ctx.supabase.from("contest_votes").select("voter_id, vote").eq("contest_id", contest.id)
    : { data: [] as { voter_id: string; vote: string }[] };
  const hasVoted = votes?.some((v) => v.voter_id === ctx.userId);
  const up = votes?.filter((v) => v.vote === "uphold").length ?? 0;
  const down = (votes?.length ?? 0) - up;

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{ROOMS[inf.room]}</h1>
        <Badge>{INFRACTION_STATUS[inf.status]}</Badge>
      </div>
      <section className={`${card} space-y-2 text-sm`}>
        <p>{inf.description}</p>
        <p className="text-neutral-500">Signalé par {name(inf.author_id)} · concerne {name(inf.accused_id)}</p>
        {inf.points && <p>Sanction : -{inf.points} points. Motif : {inf.decision_reason}</p>}
        {photos.map((src, i) => src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt="Preuve du signalement" className="max-h-80 rounded-lg" />
        ))}
      </section>

      {ctx.isAdmin && ["pending", "reviewing"].includes(inf.status) && (
        <form action={decideInfraction} className={`${card} space-y-3`}>
          <h2 className="font-medium">Décision (administrateurs)</h2>
          <input type="hidden" name="id" value={id} />
          <Field label="Points à retirer si validé">
            <select name="points" className={input}>{SANCTION_POINTS.map((p) => <option key={p} value={p}>{p} points</option>)}</select>
          </Field>
          <Field label="Motif"><textarea name="reason" required rows={2} className={input} /></Field>
          <div className="flex gap-2">
            <SubmitButton name="mode" value="validate" className={btnDanger}>Valider la sanction</SubmitButton>
            <SubmitButton name="mode" value="reject" className={btnGhost}>Rejeter</SubmitButton>
          </div>
        </form>
      )}

      {inf.status === "validated" && inf.accused_id === ctx.userId && !contest && (
        <form action={contestInfraction} className={`${card} space-y-3`}>
          <h2 className="font-medium">Contester cette sanction</h2>
          <input type="hidden" name="id" value={id} />
          <Field label="Pourquoi ?"><textarea name="reason" required rows={2} className={input} /></Field>
          <SubmitButton className={btn}>Envoyer la contestation</SubmitButton>
        </form>
      )}

      {contest && (
        <section className={`${card} space-y-3`}>
          <h2 className="font-medium">Contestation : vote de la maison</h2>
          <p className="text-sm">{contest.reason}</p>
          <p className="text-sm">Maintenir : {up} · Annuler : {down} · Majorité requise : {Math.floor(members.length / 2) + 1} voix</p>
          {contest.outcome !== "open" && <p className="text-sm font-medium">Résultat : {contest.outcome === "upheld" ? "sanction maintenue" : "sanction annulée"}</p>}
          {contest.outcome === "open" && !hasVoted && (
            <form action={castVote} className="flex gap-2">
              <input type="hidden" name="contest" value={contest.id} />
              <input type="hidden" name="id" value={id} />
              <SubmitButton name="vote" value="uphold" className={btnGhost}>Maintenir</SubmitButton>
              <SubmitButton name="vote" value="overturn" className={btn}>Annuler la sanction</SubmitButton>
            </form>
          )}
          {contest.outcome === "open" && hasVoted && <p className="text-sm text-neutral-500">Votre vote est enregistré.</p>}
        </section>
      )}
    </>
  );
}
