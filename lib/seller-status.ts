import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

// Asks Stripe "can this seller's account take card payments yet?" and saves the answer
// in our "sellers" table (that is what makes the Buy now button appear).
// Only accounts that WE created and saved are looked at.
// Returns null if the account isn't one of ours. Throws if Stripe or the database fails.
export async function refreshSellerStatus(
  stripe: Stripe,
  admin: SupabaseClient,
  accountId: string,
): Promise<{ ready: boolean; email: string } | null> {
  const { data: seller, error } = await admin.from("sellers").select("email").eq("stripe_account_id", accountId).maybeSingle();
  if (error) throw new Error(`seller lookup: ${error.message}`);
  if (!seller) return null;

  // "active" is Stripe's word for: card payments are switched on for this account.
  const account = await stripe.v2.core.accounts.retrieve(accountId, { include: ["configuration.merchant"] });
  const ready = account.configuration?.merchant?.capabilities?.card_payments?.status === "active";

  const saved = await admin
    .from("sellers")
    .update({ charges_enabled: ready, updated_at: new Date().toISOString() })
    .eq("stripe_account_id", accountId);
  if (saved.error) throw new Error(`saving seller status: ${saved.error.message}`);
  return { ready, email: seller.email as string };
}
