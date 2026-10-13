"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Ringkasan", icon: "📊" },
  { href: "/transaksi", label: "Transaksi", icon: "🧾" },
  { href: "/asisten", label: "Asisten", icon: "💬" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  const items = LINKS.map((l) => {
    const active = pathname.startsWith(l.href);
    return (
      <Link
        key={l.href}
        href={l.href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-1.5 rounded-md border-[3px] px-3 py-1 font-pixel text-sm ${
          active ? "border-ink bg-gold shadow-[2px_2px_0_var(--ink)]" : "border-transparent hover:border-ink/30"
        }`}
      >
        <span aria-hidden>{l.icon}</span>
        {l.label}
      </Link>
    );
  });

  return (
    <>
      <nav className="hidden gap-1 sm:flex">{items}</nav>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t-[3px] border-ink bg-cream px-2 py-2 sm:hidden">
        {items}
      </nav>
    </>
  );
}
