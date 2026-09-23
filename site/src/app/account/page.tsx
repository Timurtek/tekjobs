import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountPanel } from "@/components/auth/AccountPanel";
import { currentIdentity } from "@/server/auth";
import { listEntitlements } from "@/server/entitlements";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

/** The server decides who is here; the client panel only renders it and offers sign-out. */
export default async function AccountPage() {
  const who = await currentIdentity();
  if (!who) redirect("/login?next=/account");
  const entitlements = await listEntitlements(who.uid).catch(() => []);
  return (
    <section className="section">
      <div className="wrap narrow">
        <AccountPanel email={who.email} uid={who.uid} entitlements={entitlements} />
      </div>
    </section>
  );
}
