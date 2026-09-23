"use client";
import { Button, Card, Separator, Tabs, TextField, toast } from "@/components/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";

/**
 * Sign in or create an account: Google, or email and password, one card. Reset is a link under the password.
 * On success it goes to `next` at once. If the browser is already signed in to Firebase but the server had no
 * session (an expired cookie, a cleared cookie jar), it mints one and goes without asking for anything.
 */
export function AuthCard({ next = "/app/post-a-job" }: { next?: string }) {
  const auth = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resuming, setResuming] = useState(false);
  const done = () => { window.location.assign(next); };
  const resumed = useRef(false);
  useEffect(() => {
    if (!auth.ready || !auth.user || resumed.current) return;
    resumed.current = true;
    setResuming(true);
    auth.ensureSession().then((ok) => { if (ok) done(); else setResuming(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.ready, auth.user]);
  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); toast({ title: ok, tone: "success" }); done(); return; }
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
  if (resuming) {
    return (
      <Card padding="lg">
        <div className="authcard">
          <h1 className="authcard__title">Signing you in</h1>
          <p className="muted">You are already signed in on this browser; one moment.</p>
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
          <p className="consent">By continuing you agree to the <a href="/legal/terms">Terms of Use</a> and the <a href="/legal/privacy">Privacy Policy</a>. Accounts are for adults.</p>
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
