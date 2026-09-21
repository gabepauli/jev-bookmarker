import Link from "next/link";

import { SorterApp } from "@/components/sorter/sorter-app";
import { isJevConfigured, JEV_MODEL_ID } from "@/lib/jev";

// `isJevConfigured` reads the environment at request time, so this must not be prerendered.
export const dynamic = "force-dynamic";

export default function Home() {
  // Both of these come from a server-only module and cannot be imported by a client component.
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <SorterApp jevConfigured={isJevConfigured()} modelId={JEV_MODEL_ID} />

      <p className="mt-12 text-xs text-muted">
        <Link
          href="/inbox"
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          Save a single bookmark instead
        </Link>
      </p>
    </main>
  );
}
