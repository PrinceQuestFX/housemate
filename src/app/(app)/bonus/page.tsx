import { SubmitButton } from "@/components/submit-button";
import { getContext, loadMembers } from "@/lib/session";
import { decideBonus, requestBonus } from "@/server/actions";
import { BONUS_STATUS } from "@/lib/labels";
import { BONUS_POINTS } from "@/domain/rules";
import { Badge, Empty, Field, btn, btnDanger, btnGhost, card, input } from "@/components/ui";

export default async function BonusPage() {
  const ctx = await getContext();
  const members = await loadMembers(ctx);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "—";
  const { data: list } = await ctx.supabase.from("bonus_requests")
    .select("id, requester_id, beneficiary_id, points, description, status, decision_reason, created_at")
    .eq("household_id", ctx.householdId).order("created_at", { ascending: false }).limit(50);

  return (
    <>
      <h1 className="text-2xl">Bonus</h1>
      <p className="text-sm text-neutral-500">Vous avez fait une bonne action ? Demandez des points : un administrateur valide.</p>

      <form action={requestBonus} className={`${card} space-y-3`}>
        <h2 className="font-medium">Demander un bonus</h2>
        <Field label="Pour qui ?">
          <select name="beneficiary" defaultValue={ctx.userId} className={input}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.id === ctx.userId ? `Moi (${m.name})` : m.name}</option>)}
          </select>
        </Field>
        <Field label="Points">
          <select name="points" className={input}>{BONUS_POINTS.map((n) => <option key={n} value={n}>+{n} points</option>)}</select>
        </Field>
        <Field label="Quelle action mérite un bonus ?"><textarea name="description" required rows={3} className={input} /></Field>
        <SubmitButton className={btn}>Envoyer la demande</SubmitButton>
      </form>

      <section className="space-y-2">
        <h2 className="font-medium">Demandes</h2>
        {!list?.length && <Empty>Aucune demande pour le moment.</Empty>}
        {list?.map((b) => {
          const own = b.requester_id === ctx.userId || b.beneficiary_id === ctx.userId;
          return (
            <div key={b.id} className={`${card} space-y-2 text-sm`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">+{b.points} pour {name(b.beneficiary_id)}</span>
                <Badge>{BONUS_STATUS[b.status]}</Badge>
              </div>
              <p>{b.description}</p>
              <p className="text-xs text-neutral-500">Demandé par {name(b.requester_id)}{b.decision_reason ? ` · Motif : ${b.decision_reason}` : ""}</p>
              {b.status === "pending" && ctx.isAdmin && !own && (
                <form action={decideBonus} className="space-y-2">
                  <input type="hidden" name="id" value={b.id} />
                  <input name="reason" placeholder="Motif (obligatoire pour refuser)" className={input} />
                  <div className="flex gap-2">
                    <SubmitButton name="mode" value="approve" className={btn}>Accepter</SubmitButton>
                    <SubmitButton name="mode" value="reject" className={btnDanger}>Refuser</SubmitButton>
                  </div>
                </form>
              )}
              {b.status === "pending" && ctx.isAdmin && own && <p className="text-xs text-neutral-500">Un autre administrateur doit valider cette demande.</p>}
            </div>
          );
        })}
      </section>
    </>
  );
}
