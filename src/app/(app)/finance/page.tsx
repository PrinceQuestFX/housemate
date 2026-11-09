import { randomUUID } from "node:crypto";
import { getContext, loadMembers } from "@/lib/session";
import { createExpense, declareTransfer, resolveTransfer } from "@/server/actions";
import { CATEGORIES, TRANSFER_STATUS } from "@/lib/labels";
import { fmt } from "@/lib/money";
import { Badge, Empty, Field, btn, btnGhost, card, input } from "@/components/ui";

export default async function FinancePage() {
  const ctx = await getContext();
  const members = await loadMembers(ctx);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "—";
  const monthStart = new Date(); monthStart.setDate(1);
  const [{ data: balances }, { data: expenses }, { data: transfers }] = await Promise.all([
    ctx.supabase.from("member_balances").select("user_id, balance_minor").eq("household_id", ctx.householdId),
    ctx.supabase.from("expenses").select("id, title, amount_minor, category, spent_on, paid_by")
      .eq("household_id", ctx.householdId).order("spent_on", { ascending: false }).limit(50),
    ctx.supabase.from("money_transfers").select("id, from_user, to_user, amount_minor, status, created_at")
      .eq("household_id", ctx.householdId).order("created_at", { ascending: false }).limit(30),
  ]);
  const monthTotal = (expenses ?? []).filter((e) => e.spent_on >= monthStart.toISOString().slice(0, 10)).reduce((s, e) => s + Number(e.amount_minor), 0);

  return (
    <>
      <h1 className="text-2xl font-semibold">Finances</h1>
      <section className={card}>
        <h2 className="mb-2 font-medium">Soldes (positif = on vous doit)</h2>
        <ul className="space-y-1 text-sm">
          {(balances ?? []).map((b) => (
            <li key={b.user_id} className="flex justify-between"><span>{name(b.user_id)}</span><span>{fmt(Number(b.balance_minor))}</span></li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-neutral-500">Dépenses du mois : {fmt(monthTotal)}</p>
      </section>

      <details className={card}>
        <summary className="cursor-pointer font-medium">Ajouter une dépense</summary>
        <form action={createExpense} className="mt-4 space-y-3">
          <input type="hidden" name="key" value={randomUUID()} />
          <Field label="Intitulé"><input name="title" required className={input} /></Field>
          <Field label="Montant (DH)"><input name="amount" inputMode="decimal" required className={input} /></Field>
          <Field label="Catégorie">
            <select name="category" className={input}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Field>
          <Field label="Date"><input name="date" type="date" className={input} /></Field>
          <Field label="Payé par">
            <select name="paid_by" defaultValue={ctx.userId} className={input}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </Field>
          <fieldset className="space-y-1"><legend className="text-sm text-neutral-600">Membres concernés (parts égales)</legend>
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="members" value={m.id} defaultChecked />{m.name}</label>
            ))}
          </fieldset>
          <Field label="Justificatif (facultatif)"><input name="receipt" type="file" accept="image/*" className={input} /></Field>
          <button className={btn}>Enregistrer</button>
        </form>
      </details>

      <details className={card}>
        <summary className="cursor-pointer font-medium">Déclarer une remise d'argent</summary>
        <form action={declareTransfer} className="mt-4 space-y-3">
          <input type="hidden" name="key" value={randomUUID()} />
          <Field label="Remis à">
            <select name="to" required className={input}>{members.filter((m) => m.id !== ctx.userId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </Field>
          <Field label="Montant (DH)"><input name="amount" inputMode="decimal" required className={input} /></Field>
          <button className={btn}>Déclarer</button>
        </form>
      </details>

      <section className="space-y-2">
        <h2 className="font-medium">Remises d'argent</h2>
        {!transfers?.length && <Empty>Aucune remise enregistrée.</Empty>}
        {transfers?.map((t) => (
          <div key={t.id} className={`${card} space-y-2 text-sm`}>
            <div className="flex justify-between"><span>{name(t.from_user)} → {name(t.to_user)} · {fmt(Number(t.amount_minor))}</span><Badge>{TRANSFER_STATUS[t.status]}</Badge></div>
            {t.status === "pending" && t.to_user === ctx.userId && (
              <form action={resolveTransfer} className="flex gap-2">
                <input type="hidden" name="id" value={t.id} />
                <button name="accept" value="true" className={btn}>Confirmer la réception</button>
                <button name="accept" value="false" className={btnGhost}>Contester</button>
              </form>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Dépenses</h2>
        {!expenses?.length && <Empty>Aucune dépense enregistrée.</Empty>}
        {expenses?.map((e) => (
          <div key={e.id} className={`${card} flex justify-between text-sm`}>
            <span>{e.title} · {CATEGORIES[e.category]} · payé par {name(e.paid_by)}</span><span>{fmt(Number(e.amount_minor))}</span>
          </div>
        ))}
      </section>
    </>
  );
}
