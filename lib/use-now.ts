"use client";

import { useSyncExternalStore } from "react";

// Returns "the current time" and refreshes it every 30 seconds, so labels like
// "listed 5 minutes ago" stay up to date without a page reload.
function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 30_000);
  return () => clearInterval(id);
}
const now = () => Math.floor(Date.now() / 30_000) * 30_000;

export function useNow() {
  return useSyncExternalStore(subscribe, now, () => 0);
}
