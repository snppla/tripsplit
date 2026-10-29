import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "TripSplit",
  description: "Track shared trip expenses and settle up with friends.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <header className="border-b border-stone-200 bg-white/80 backdrop-blur dark:border-stone-800 dark:bg-stone-900/80">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
                <rect width="32" height="32" rx="7" className="fill-brand-600" />
                <g fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 12h15M19 8l4 4-4 4" />
                  <path d="M24 20H9M13 16l-4 4 4 4" />
                </g>
              </svg>
              TripSplit
            </Link>
            {user && (
              <div className="flex items-center gap-3">
                {user.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt="" className="size-8 rounded-full" referrerPolicy="no-referrer" />
                )}
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button className="text-sm muted hover:text-stone-900 dark:hover:text-white">Sign out</button>
                </form>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
