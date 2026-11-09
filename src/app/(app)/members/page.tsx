import { getContext, loadMembers, currentPeriod } from "@/lib/session";
import { monthlyScore } from "@/domain/rules";
import { fmt } from "@/lib/money";
import { adminClient } from "@/lib/supabase/admin";
import { approveMember, rejectMember, setRole } from "@/server/account-actions";
import { AddMemberForm } from "@/components/add-member-form";
import { Badge, btn, btnDanger, btnGhost, card } from "@/components/ui";

export default async function MembersPage() {
  const ctx = await getContext();
  const members = await loadMembers(ctx);
  const [{ data: pts }, { data: bal }] = await Promise.all([
    ctx.supabase.from("point_transactions").select("user_id, delta").eq("household_id", ctx.householdId).eq("period", currentPeriod()),
    ctx.supabase.from("member_balances").select("user_id, balance_minor").eq("household_id", ctx.householdId),
  ]);
  let pending: { id: string; name: string; email: string }[] = [];
  if (ctx.isAdmin) {
    const a = adminClient();
    const [{ data: us }, { data: ms }, { data: ps }] = await Promise.all([
      a.auth.admin.listUsers({ perPage: 200 }), a.from("household_members").select("user_id"), a.from("profiles").select("id, first_name, last_name"),
    ]);
    const inHouse = new Set((ms ?? []).map((m) => m.user_id));
    pending = (us?.users ?? []).filter((u) => !inHouse.has(u.id)).map((u) => {
      const p = ps?.find((x) => x.id === u.id);
      return { id: u.id, email: u.email ?? "", name: `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "Nouveau" };
    });
  }
  return (
    <>
      <h1 className="text-2xl">Membres</h1>
      {pending.length > 0 && (
        <section className={`${card} space-y-3`}>
          <h2 className="font-medium">Demandes en attente ({pending.length})</h2>
          {pending.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{p.name}<span className="block text-xs text-neutral-500">{p.email}</span></span>
              <span className="flex gap-2">
                <form action={approveMember}><input type="hidden" name="id" value={p.id} /><button className={btn}>Accepter</button></form>
                <form action={rejectMember}><input type="hidden" name="id" value={p.id} /><button className={btnDanger}>Refuser</button></form>
              </span>
            </div>
          ))}
        </section>
      )}
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.id} className={`${card} flex items-center justify-between gap-2 text-sm`}>
            <span>
              {m.name} {m.role === "admin" && <Badge>Admin</Badge>}
              {ctx.isAdmin && m.id !== ctx.userId && (
                <form action={setRole} className="mt-2">
                  <input type="hidden" name="id" value={m.id} /><input type="hidden" name="role" value={m.role === "admin" ? "member" : "admin"} />
                  <button className={btnGhost}>{m.role === "admin" ? "Retirer admin" : "Nommer admin"}</button>
                </form>
              )}
            </span>
            <span className="text-right">
              {monthlyScore((pts ?? []).filter((p) => p.user_id === m.id).map((p) => p.delta))} pts
              <span className="block text-xs text-neutral-500">{fmt(Number(bal?.find((b) => b.user_id === m.id)?.balance_minor ?? 0))}</span>
            </span>
          </li>
        ))}
      </ul>
      {ctx.isAdmin && (
        <section className={`${card} space-y-3`}>
          <h2 className="font-medium">Ajouter un membre directement</h2>
          <AddMemberForm />
        </section>
      )}
    </>
  );
}
