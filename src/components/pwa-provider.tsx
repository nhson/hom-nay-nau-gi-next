"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";

/** Registers the service worker (production only: a worker in `next dev` caches stale code). */
export function PwaProvider({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV !== "production"}
      options={{ scope: "/" }}
    >
      {children}
    </SerwistProvider>
  );
}
