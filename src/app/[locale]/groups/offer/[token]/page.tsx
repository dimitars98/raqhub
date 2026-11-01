import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/layout/Navbar";
import OfferClient, { type OfferInfo } from "@/components/groups/OfferClient";

// A place offered from a waiting list. The link in the email is the key, so
// it works for parents without a RaqHub account.
export default async function GroupOfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const valid = /^[0-9a-f-]{36}$/i.test(token);
  const { data } = valid ? await supabase.rpc("group_offer_info", { p_token: token }) : { data: null };

  return (
    <div className="min-h-screen bg-ink-50">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-10 sm:py-16">
        <OfferClient token={token} info={(data as OfferInfo | null) ?? null} />
      </main>
    </div>
  );
}
