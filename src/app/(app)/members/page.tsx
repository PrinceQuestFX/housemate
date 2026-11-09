import { getContext, loadMembers, currentPeriod } from "@/lib/session";
import { monthlyScore } from "@/domain/rules";
import { fmt } from "@/lib/money";
import { AddMemberForm } from "@/components/add-member-form";
import { Badge, card } from "@/components/ui";

export default async function MembersPage() {
  const ctx = await getContext();
  const members = await loadMembers(ctx);
  const [{ data: pts }, { data: bal }] = await Promise.all([
    ctx.supabase.from("point_transactions").select("user_id, delta").eq("household_id", ctx.householdId).eq("period", currentPeriod()),
    ctx.supabase.from("member_balances").select("user_id, balance_minor").eq("household_id", ctx.householdId),
  ]);
  return (
    <>
      <h1 className="text-2xl font-semibold">Membres</h1>
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.id} className={`${card} flex items-center justify-between text-sm`}>
            <span>{m.name} {m.role === "admin" && <Badge>Admin</Badge>}</span>
            <span className="text-right">
              {monthlyScore((pts ?? []).filter((p) => p.user_id === m.id).map((p) => p.delta))} pts
              <span className="block text-xs text-neutral-500">{fmt(Number(bal?.find((b) => b.user_id === m.id)?.balance_minor ?? 0))}</span>
            </span>
          </li>
        ))}
      </ul>
      {ctx.isAdmin && (
        <section className={`${card} space-y-3`}>
          <h2 className="font-medium">Ajouter un membre</h2>
          <AddMemberForm />
        </section>
      )}
    </>
  );
}
