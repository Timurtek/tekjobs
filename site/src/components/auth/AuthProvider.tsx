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
  signOut: () => Promise<void>;
};

const noop = async () => { throw new Error("Sign-in is not configured on this site."); };
const Ctx = createContext<AuthState>({ configured: false, ready: true, user: null, signInWithGoogle: noop, signInWithEmail: noop, createAccount: noop, resetPassword: noop, signOut: async () => {} });

/**
 * Firebase auth on the client. Every ID token change is posted to /api/auth/session so the server holds a
 * session cookie too; sign-out clears both. With no Firebase keys the provider is inert and `configured` is
 * false, which is what hides Sign in everywhere.
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
      if (u) {
        const idToken = await u.getIdToken();
        await fetch("/api/auth/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) }).catch(() => {});
      }
    });
  }, []);
  const need = () => { const a = getFirebaseAuth(); if (!a) throw new Error("Sign-in is not configured on this site."); return a; };
  const value: AuthState = {
    configured: firebaseConfigured,
    ready,
    user,
    signInWithGoogle: async () => { await signInWithPopup(need(), new GoogleAuthProvider()); },
    signInWithEmail: async (email, password) => { await signInWithEmailAndPassword(need(), email, password); },
    createAccount: async (email, password) => { await createUserWithEmailAndPassword(need(), email, password); },
    resetPassword: async (email) => { await sendPasswordResetEmail(need(), email); },
    signOut: async () => { await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {}); const a = getFirebaseAuth(); if (a) await fbSignOut(a); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
