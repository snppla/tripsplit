"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

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
    { href: `${base}/payments`, label: "Payments", active: pathname.startsWith(`${base}/payments`) },
    { href: `${base}/balances`, label: "Balances", active: pathname.startsWith(`${base}/balances`) },
    { href: `${base}/people`, label: "People", active: pathname.startsWith(`${base}/people`) },
    { href: `${base}/history`, label: "History", active: pathname.startsWith(`${base}/history`) },
    ...(isOwner
      ? [{ href: `${base}/settings`, label: "Settings", active: pathname.startsWith(`${base}/settings`) }]
      : []),
  ];
  // On narrow screens the tabs scroll sideways; keep the current one in view.
  const activeRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl bg-stone-200/60 p-1 [scrollbar-width:none] dark:bg-stone-800/60">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          ref={t.active ? activeRef : undefined}
          aria-current={t.active ? "page" : undefined}
          className={`flex-1 shrink-0 whitespace-nowrap rounded-lg px-2.5 py-2 text-center text-xs font-medium sm:text-sm transition ${
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
