import { ConnectForm } from "@/components/connect-form";

export const metadata = { title: "Get paid with Stripe · Marketplace" };

// Sellers connect a Stripe account here, to be paid when their items sell.
export default function ConnectPage() {
  return <ConnectForm />;
}
