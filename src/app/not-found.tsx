import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card p-8 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="muted mt-2">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/" className="btn-secondary mt-6">Back to your trips</Link>
    </div>
  );
}
