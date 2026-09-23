import "server-only";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * The Admin SDK, initialised once per server. Credentials come from FIREBASE_SERVICE_ACCOUNT (the JSON as one
 * line), else the emulator, else application default credentials. `adminConfigured` is false when none of
 * those can work, and every route that needs it answers 503 rather than throwing.
 */
export const adminConfigured = !!(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIRESTORE_EMULATOR_HOST || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID);

/**
 * FIREBASE_SERVICE_ACCOUNT as people actually paste it: the JSON on one line, sometimes wrapped in the single
 * quotes a .env file needs, sometimes base64 to dodge quoting altogether. All three parse.
 */
function serviceAccount(): Record<string, string> | null {
  let raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (!raw) return null;
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"') && !raw.startsWith('{"'))) raw = raw.slice(1, -1).trim();
  if (!raw.startsWith("{")) { try { raw = Buffer.from(raw, "base64").toString("utf8").trim(); } catch { /* not base64 either; JSON.parse will say so */ } }
  try { return JSON.parse(raw) as Record<string, string>; }
  catch (e) { throw new Error(`FIREBASE_SERVICE_ACCOUNT is not the service-account JSON (${(e as Error).message.slice(0, 60)}). Paste the file's contents on one line, without surrounding quotes, or base64-encode it.`); }
}

let app: App | null = null;
function admin(): App {
  if (app) return app;
  if (getApps().length) { app = getApps()[0]!; return app; }
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const sa = serviceAccount();
  app = sa
    ? initializeApp({ credential: cert(sa), projectId })
    : process.env.FIRESTORE_EMULATOR_HOST
      ? initializeApp({ projectId: projectId || "demo-tekjobs" })
      : initializeApp({ credential: applicationDefault(), projectId });
  return app;
}

export const db = () => getFirestore(admin());
export const adminAuth = () => getAuth(admin());

export const SESSION_COOKIE = "tj_session";
/** Two weeks, the Admin SDK's maximum. */
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export const verifyIdToken = (token: string) => adminAuth().verifyIdToken(token, true);
export const createSessionCookie = (idToken: string) => adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
export const verifySessionCookie = (cookie: string) => adminAuth().verifySessionCookie(cookie, true);
