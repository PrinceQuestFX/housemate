import type { ReactNode } from "react";

export const input =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";
export const btn =
  "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50";
export const btnGhost = "rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700";
export const btnDanger = "rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800";
export const card = "rounded-xl border border-neutral-200 p-4 dark:border-neutral-800";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-neutral-600 dark:text-neutral-400">{label}</span>
      {children}
    </label>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">{children}</span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-neutral-500">{children}</p>;
}
