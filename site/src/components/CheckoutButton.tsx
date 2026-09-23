"use client";
import { Button, toast } from "@/components/ui";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

/** Starts Checkout when purchases are open and the visitor is signed in; otherwise says what is missing. */
export function CheckoutButton({ open }: { open: boolean }) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  if (!open) return <p className="muted">Not on sale yet. Watch the repository, or the changelog, for the release that opens it.</p>;
  if (!auth.configured) return <p className="muted">Purchases need sign-in, which is not configured on this deployment.</p>;
  if (!auth.user) return <Button asChild tone="primary"><a href="/login?next=/post-a-job">Sign in to continue</a></Button>;
  const go = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/checkout", { method: "POST" });
      const data = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !data.url) throw new Error(data.error || `Checkout answered ${r.status}`);
      window.location.assign(data.url);
    } catch (e) { toast({ title: "Could not start checkout", description: (e as Error).message, tone: "danger" }); setBusy(false); }
  };
  return <Button tone="primary" loading={busy} onClick={go}>Continue to payment</Button>;
}
