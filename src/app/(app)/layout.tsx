import "../theme.css";
import type { ReactNode } from "react";
import { getContext } from "@/lib/session";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { NavLink } from "@/components/nav-link";
import { logout } from "../(auth)/actions";

const MAIN = [["/dashboard", "Accueil"], ["/discipline", "Discipline"], ["/finance", "Finances"], ["/cleaning", "Ménage"], ["/notifications", "Alertes"]] as const;
const MORE = [["/wall", "Mur"], ["/members", "Membres"], ["/reports", "Rapports"], ["/history", "Historique"], ["/settings", "Réglages"]] as const;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase, userId } = await getContext();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-24">
      <RealtimeRefresh userId={userId} />
      <header className="sticky top-0 z-10 space-y-3 border-b border-teal-700/40 bg-[#10272B]/80 p-4 backdrop-blur print:hidden">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-lg">
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 12 3l9 8v10H3z" fill="#F4B942" /><rect x="10" y="14" width="4" height="7" rx="1" fill="#10272B" /></svg>
            <span className="hm-brand">HOUSEMATE</span>
          </span>
          <form action={logout}><button className="rounded-full border border-teal-600/60 px-3 py-1 text-sm text-teal-100 hover:bg-teal-800/40">Déconnexion</button></form>
        </div>
        <ul className="flex flex-wrap gap-2">{MORE.map(([h, l]) => <li key={h}><NavLink href={h} pill>{l}</NavLink></li>)}</ul>
      </header>
      <main className="space-y-6 p-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-teal-700/40 bg-[#10272B]/90 backdrop-blur print:hidden" aria-label="Navigation principale">
        <ul className="mx-auto flex max-w-3xl justify-around p-2 text-xs">
          {MAIN.map(([h, l]) => <li key={h}><NavLink href={h}>{l}{h === "/notifications" && count ? ` (${count})` : ""}</NavLink></li>)}
        </ul>
      </nav>
    </div>
  );
}
