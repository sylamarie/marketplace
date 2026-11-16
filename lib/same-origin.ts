import type { NextRequest } from "next/server";

// True when the request comes from our own website (or from something that isn't a
// browser, which sends no "origin"). This stops other websites' scripts from calling
// our routes on a visitor's behalf.
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

// Who is calling, for the "not too many too fast" limiter.
export function visitorId(request: NextRequest): string {
  return (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim();
}
