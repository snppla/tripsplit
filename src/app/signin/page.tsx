import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { DEV_USERS, devLoginEnabled } from "@/lib/dev-login";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  // Only allow same-site redirects.
  const target = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  if ((await auth())?.user) redirect(target);

  return (
    <div className="mx-auto max-w-sm pt-10 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Split trip costs, minus the spreadsheet</h1>
      <p className="muted mt-3">
        Log who paid for what during the trip. At the end, TripSplit works out who owes whom.
      </p>
      {(process.env.AUTH_GOOGLE_ID || !devLoginEnabled()) && (
        <form
          className="mt-8"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: target });
          }}
        >
          <button className="btn-secondary w-full py-3">
            <GoogleIcon />
            Continue with Google
          </button>
        </form>
      )}
      {devLoginEnabled() && <DevLogin callbackUrl={target} />}
    </div>
  );
}

function DevLogin({ callbackUrl }: { callbackUrl: string }) {
  return (
    <div className="mt-8 rounded-2xl border-2 border-dashed border-amber-300 p-4 text-left dark:border-amber-700">
      <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Dev login</p>
      <p className="muted mb-3 text-xs">
        Only in the dev server. Use a private window or a different browser profile to be signed in as two people at once.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {DEV_USERS.map((u) => (
          <form key={u.email} action="/api/dev-login" method="post">
            <input type="hidden" name="email" value={u.email} />
            <input type="hidden" name="name" value={u.name} />
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <button className="btn-secondary btn-sm w-full">{u.name.split(" ")[0]}</button>
          </form>
        ))}
      </div>
      <form action="/api/dev-login" method="post" className="mt-3 flex gap-2">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <input name="email" type="email" required placeholder="any@email.com" className="input py-1.5!" />
        <button className="btn-secondary btn-sm">Go</button>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}
