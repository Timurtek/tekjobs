"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, onIdTokenChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut as fbSignOut, type User } from "firebase/auth";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebaseClient";

type AuthState = {
  configured: boolean;
  ready: boolean;
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createAccount: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Mint the server session cookie for the signed-in user. Resolves once the server has it, so a navigation after it lands signed in. */
  ensureSession: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

const noop = async () => { throw new Error("Sign-in is not configured on this site."); };
const Ctx = createContext<AuthState>({ configured: false, ready: true, user: null, signInWithGoogle: noop, signInWithEmail: noop, createAccount: noop, resetPassword: noop, ensureSession: async () => false, signOut: async () => {} });

/** Post a fresh ID token; the server answers once the cookie is set. */
async function mint(u: User): Promise<boolean> {
  try {
    const idToken = await u.getIdToken();
    const r = await fetch("/api/auth/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
    return r.ok;
  } catch { return false; }
}

/**
 * Firebase auth on the client. Signing in mints the server's session cookie before it resolves, so the page
 * you are sent to next already knows you; later token refreshes re-mint it in the background. Sign-out
 * clears both. With no Firebase keys the provider is inert and `configured` is false, which hides Sign in.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!firebaseConfigured);
  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    return onIdTokenChanged(auth, async (u) => {
      setUser(u);
      setReady(true);
      if (u) await mint(u);
    });
  }, []);
  const need = () => { const a = getFirebaseAuth(); if (!a) throw new Error("Sign-in is not configured on this site."); return a; };
  const signedIn = async (u: User) => { if (!(await mint(u))) throw new Error("Signed in, but the server could not start a session. Try again."); };
  const value: AuthState = {
    configured: firebaseConfigured,
    ready,
    user,
    signInWithGoogle: async () => { const c = await signInWithPopup(need(), new GoogleAuthProvider()); await signedIn(c.user); },
    signInWithEmail: async (email, password) => { const c = await signInWithEmailAndPassword(need(), email, password); await signedIn(c.user); },
    createAccount: async (email, password) => { const c = await createUserWithEmailAndPassword(need(), email, password); await signedIn(c.user); },
    resetPassword: async (email) => { await sendPasswordResetEmail(need(), email); },
    ensureSession: async () => { const u = getFirebaseAuth()?.currentUser; return u ? mint(u) : false; },
    signOut: async () => { await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {}); const a = getFirebaseAuth(); if (a) await fbSignOut(a); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
