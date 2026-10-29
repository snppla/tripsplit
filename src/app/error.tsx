"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Catch-all for unexpected errors, rendered inside the app's layout. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="card p-8 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="muted mt-2 text-sm">Try again, or head back to your trips.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" className="btn-primary" onClick={reset}>Try again</button>
        <Link href="/" className="btn-secondary">All trips</Link>
      </div>
      {error.digest && <p className="muted mt-6 font-mono text-xs">Error {error.digest}</p>}
    </div>
  );
}
