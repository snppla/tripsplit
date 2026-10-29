"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary btn-sm shrink-0"
      onClick={async () => {
        if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
          await navigator.share({ url: text }).catch(() => {});
          return;
        }
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
