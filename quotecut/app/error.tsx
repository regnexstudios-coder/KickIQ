"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-zinc-400">Please try again. If it keeps happening, reload the page.</p>
        <button onClick={reset} className="btn-primary mt-6">
          Try again
        </button>
      </div>
    </main>
  );
}
