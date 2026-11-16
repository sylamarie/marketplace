// A small "not too many too fast" limiter. It remembers recent requests in the
// server's memory. That is a best-effort protection, not a perfect one: the
// memory is cleared whenever the server restarts, and each server instance has
// its own. It still stops a simple script from flooding someone with email.

export type Limiter = {
  // Returns true if this request is allowed, false if it is over the limit.
  allow: (key: string) => boolean;
};

export function createLimiter(options: {
  max: number; // how many requests are allowed...
  windowMs: number; // ...in this many milliseconds
  maxKeys?: number; // safety cap on how many different keys we remember
  now?: () => number; // a clock (replaced in tests)
}): Limiter {
  const { max, windowMs, maxKeys = 5000, now = Date.now } = options;
  const hits = new Map<string, number[]>();

  return {
    allow(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((time) => t - time < windowMs);

      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);

      // Keep memory small: if we remember too many keys, forget the oldest ones.
      if (hits.size > maxKeys) {
        for (const [k, times] of hits) {
          if (times.every((time) => t - time >= windowMs)) hits.delete(k);
          if (hits.size <= maxKeys) break;
        }
        while (hits.size > maxKeys) hits.delete(hits.keys().next().value as string);
      }
      return true;
    },
  };
}
