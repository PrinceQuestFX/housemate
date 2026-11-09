import { SubmitButton } from "@/components/submit-button";
import { getContext, loadMembers } from "@/lib/session";
import { assignCleaning, completeCleaning, verifyCleaning } from "@/server/actions";
import { generateCycle } from "@/server/cycle-actions";
import { CLEANING_STATUS, ROOMS } from "@/lib/labels";
import { Badge, Empty, Field, btn, btnGhost, card, input } from "@/components/ui";

export default async function CleaningPage({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  const { cycle } = await searchParams;
  const ctx = await getContext();
  const members = await loadMembers(ctx);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "—";
  const { data: tasks } = await ctx.supabase.from("cleaning_assignments")
    .select("id, title, room, assignee_id, due_on, status, refusal_reason")
    .eq("household_id", ctx.householdId).order("due_on", { ascending: true }).limit(100);

  return (
    <>
      <h1 className="text-2xl font-semibold">Ménage</h1>

      {ctx.isAdmin && (
        <details className={card}>
          <summary className="cursor-pointer font-medium">Attribuer une tâche</summary>
          <form action={assignCleaning} className="mt-4 space-y-3">
            <Field label="Tâche"><input name="title" required className={input} /></Field>
            <Field label="Pièce">
              <select name="room" className={input}><option value="">—</option>{Object.entries(ROOMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </Field>
            <Field label="Responsable"><select name="assignee" className={input}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
            <Field label="Échéance"><input name="due" type="date" required className={input} /></Field>
            <SubmitButton className={btn}>Attribuer</SubmitButton>
          </form>
        </details>
      )}

      {ctx.isAdmin && (
        <details className={card}>
          <summary className="cursor-pointer font-medium">Programme du cycle (15 jours)</summary>
          <form action={generateCycle} className="mt-4 space-y-3">
            <p className="text-sm text-neutral-500">Une journée de ménage par personne, tous les 3 jours. Les dates passées et les doublons sont ignorés.</p>
            <Field label="Date du jour 1"><input name="start" type="date" defaultValue="2026-11-08" required className={input} /></Field>
            {[1, 4, 7, 10, 13].map((d, i) => (
              <Field key={d} label={`Jour ${d}`}>
                <select name={`s${i}`} defaultValue={members[i]?.id} className={input}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              </Field>
            ))}
            <Field label="Nombre de cycles"><select name="cycles" defaultValue="2" className={input}><option>1</option><option>2</option><option>3</option></select></Field>
            <SubmitButton className={btn}>Générer le programme</SubmitButton>
          </form>
        </details>
      )}
      {cycle && <p role="status" className="text-sm text-emerald-300">{cycle === "err" ? "Programme incomplet : choisissez une personne pour chaque jour." : `${cycle} tâche(s) de ménage créée(s).`}</p>}

      {!tasks?.length && <Empty>Aucune tâche planifiée.</Empty>}
      {tasks?.map((t) => (
        <article key={t.id} className={`${card} space-y-2 text-sm`}>
          <div className="flex items-center justify-between">
            <span className="font-medium">{t.title}{t.room ? ` · ${ROOMS[t.room]}` : ""}</span>
            <Badge>{CLEANING_STATUS[t.status]}</Badge>
          </div>
          <p className="text-neutral-500">{name(t.assignee_id)} · échéance {t.due_on}</p>
          {t.status === "to_fix" && t.refusal_reason && <p className="text-red-600">Refusé : {t.refusal_reason}</p>}

          {t.assignee_id === ctx.userId && ["todo", "to_fix"].includes(t.status) && (
            <form action={completeCleaning} className="space-y-2">
              <input type="hidden" name="id" value={t.id} />
              <input name="proof" type="file" accept="image/*" className={input} />
              <SubmitButton className={btn}>Terminé</SubmitButton>
            </form>
          )}
          {t.status === "to_verify" && t.assignee_id !== ctx.userId && (
            <form action={verifyCleaning} className="space-y-2">
              <input type="hidden" name="id" value={t.id} />
              <input name="reason" placeholder="Motif (obligatoire si refus)" className={input} />
              <div className="flex gap-2">
                <SubmitButton name="accept" value="true" className={btn}>Accepter</SubmitButton>
                <SubmitButton name="accept" value="false" className={btnGhost}>Refuser</SubmitButton>
              </div>
            </form>
          )}
        </article>
      ))}
    </>
  );
}
