"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BackToTrips() {
  return (
    <Link
      href="/"
      className="muted -ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm hover:text-stone-900 dark:hover:text-white"
    >
      <span aria-hidden>←</span> All trips
    </Link>
  );
}

export function TripTabs({ tripId, isOwner }: { tripId: string; isOwner: boolean }) {
  const pathname = usePathname();
  const base = `/trips/${tripId}`;
  const tabs = [
    { href: base, label: "Expenses", active: pathname === base || pathname.startsWith(`${base}/expenses`) },
    { href: `${base}/balances`, label: "Balances", active: pathname.startsWith(`${base}/balances`) },
    { href: `${base}/people`, label: "People", active: pathname.startsWith(`${base}/people`) },
    { href: `${base}/history`, label: "History", active: pathname.startsWith(`${base}/history`) },
    ...(isOwner
      ? [{ href: `${base}/settings`, label: "Settings", active: pathname.startsWith(`${base}/settings`) }]
      : []),
  ];
  return (
    <nav className="flex gap-1 rounded-xl bg-stone-200/60 p-1 dark:bg-stone-800/60">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`flex-1 rounded-lg px-1 py-2 text-center text-xs font-medium sm:text-sm transition ${
            t.active
              ? "bg-white shadow-sm dark:bg-stone-900"
              : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
