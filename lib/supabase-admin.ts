import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// A Supabase connection that is allowed to read and write EVERYTHING (it ignores the
// Row Level Security rules). It is used only by the Stripe routes in app/api, to
// save sellers and orders and to mark listings as sold. It uses the "secret" key, so
// this file must never be imported by a "use client" file. The key's name has no
// NEXT_PUBLIC_ in it on purpose, so it can't reach the browser.
export function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
