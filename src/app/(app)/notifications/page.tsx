import { getContext } from "@/lib/session";
import { markAllRead } from "@/server/actions";
import { NOTIFICATION_KINDS } from "@/lib/labels";
import { Empty, btnGhost, card } from "@/components/ui";

export default async function NotificationsPage() {
  const { supabase, userId } = await getContext();
  const { data } = await supabase.from("notifications").select("id, kind, read_at, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(100);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <form action={markAllRead}><button className={btnGhost}>Tout marquer comme lu</button></form>
      </div>
      {!data?.length && <Empty>Rien pour le moment.</Empty>}
      <ul className="space-y-2">
        {data?.map((n) => (
          <li key={n.id} className={`${card} text-sm ${n.read_at ? "opacity-60" : "font-medium"}`}>
            {NOTIFICATION_KINDS[n.kind] ?? n.kind}
            <span className="block text-xs font-normal text-neutral-500">{new Date(n.created_at).toLocaleString("fr-MA")}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
