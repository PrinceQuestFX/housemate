import type { ReactNode } from "react";

export const input =
  "w-full rounded-xl border border-teal-700/60 bg-[#10272B] px-3 py-2 text-sm text-white placeholder:text-teal-200/40 focus-visible:outline-2 focus-visible:outline-emerald-300";
export const btn =
  "rounded-xl bg-gradient-to-r from-amber-300 to-amber-400 px-4 py-2 text-sm font-bold text-[#10272B] shadow-lg shadow-amber-500/20 transition hover:brightness-110 active:scale-95 disabled:opacity-50";
export const btnGhost = "rounded-xl border border-teal-600/60 px-4 py-2 text-sm text-teal-100 transition hover:bg-teal-800/40 active:scale-95";
export const btnDanger = "rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-400 active:scale-95";
export const card = "rounded-2xl border border-teal-700/50 bg-gradient-to-br from-[#1B3F45] to-[#143238] p-4 shadow-lg shadow-black/20";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-teal-100/70">{label}</span>
      {children}
    </label>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-xs font-semibold text-amber-200">{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-teal-600/60 p-6 text-center text-sm text-teal-100/70">{children}</p>;
}
