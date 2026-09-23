"use client";
import { Button, Card, Separator, Tabs, TextField, toast } from "@/components/ui";
import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";

/** Sign in or create an account: Google, or email and password, one card. Reset is a link under the password. */
export function AuthCard({ next = "/account" }: { next?: string }) {
  const auth = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const done = () => { window.location.assign(next); };
  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); toast({ title: ok, tone: "success" }); done(); }
    catch (e) { toast({ title: "That did not work", description: (e as Error).message.replace(/^Firebase: /, "").replace(/ \(auth\/.*\)\.?$/, ""), tone: "danger" }); }
    setBusy(false);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "in") run(() => auth.signInWithEmail(email, password), "Signed in");
    else run(() => auth.createAccount(email, password), "Account created");
  };
  if (!auth.configured) {
    return (
      <Card padding="lg">
        <div className="authcard">
          <h1 className="authcard__title">Sign-in is not on yet</h1>
          <p className="muted">This deployment has no Firebase project configured. The landing page and the docs work without one; accounts arrive with job posting.</p>
        </div>
      </Card>
    );
  }
  return (
    <Card padding="lg">
      <div className="authcard">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "in" | "up")} variant="pill" size="sm">
          <Tabs.List aria-label="Sign in or create an account">
            <Tabs.Trigger value="in">Sign in</Tabs.Trigger>
            <Tabs.Trigger value="up">Create account</Tabs.Trigger>
          </Tabs.List>
        </Tabs>
        <Button variant="soft" size="md" disabled={busy} onClick={() => run(auth.signInWithGoogle, "Signed in")}>Continue with Google</Button>
        <Separator />
        <form className="authcard__form" onSubmit={submit}>
          <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" tone="primary" loading={busy}>{mode === "in" ? "Sign in" : "Create account"}</Button>
          {mode === "in" && (
            <Button type="button" variant="link" size="sm" tone="neutral" disabled={!email || busy} onClick={() => run(() => auth.resetPassword(email), "Reset email sent")}>
              Send a password reset to {email || "your email"}
            </Button>
          )}
        </form>
      </div>
    </Card>
  );
}
