import Link from "next/link";
import type { ReactNode } from "react";
import { getContext } from "@/lib/session";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { logout } from "../(auth)/actions";

const MAIN = [
  ["/dashboard", "Accueil"], ["/discipline", "Discipline"], ["/finance", "Finances"],
  ["/cleaning", "Ménage"], ["/notifications", "Alertes"],
] as const;
const MORE = [["/wall", "Mur"], ["/members", "Membres"], ["/reports", "Rapports"], ["/history", "Historique"], ["/settings", "Réglages"]] as const;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase, userId } = await getContext();
  const { count } = await supabase
    .from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);

  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-20">
      <RealtimeRefresh userId={userId} />
      <header className="space-y-2 p-4 print:hidden">
        <div className="flex items-center justify-between">
          <span className="font-semibold tracking-tight">HOUSEMATE</span>
          <form action={logout}><button className="text-sm underline">Déconnexion</button></form>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
          {MORE.map(([href, label]) => <li key={href}><Link href={href} className="underline-offset-4 hover:underline">{label}</Link></li>)}
        </ul>
      </header>
      <main className="space-y-6 p-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 border-t bg-white/95 backdrop-blur print:hidden dark:bg-neutral-950/95" aria-label="Navigation principale">
        <ul className="mx-auto flex max-w-3xl justify-around p-2 text-xs">
          {MAIN.map(([href, label]) => (
            <li key={href}><Link href={href} className="block px-3 py-2">{label}{href === "/notifications" && count ? ` (${count})` : ""}</Link></li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
