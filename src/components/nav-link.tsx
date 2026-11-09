"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children, pill }: { href: string; children: ReactNode; pill?: boolean }) {
  const on = usePathname().startsWith(href);
  const base = pill ? "rounded-full px-3 py-1 text-sm" : "block rounded-xl px-3 py-2";
  return (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={`${base} transition ${on ? "bg-amber-300 font-bold text-[#10272B]" : "text-teal-100/80 hover:bg-teal-700/40"}`}>
      {children}
    </Link>
  );
}
