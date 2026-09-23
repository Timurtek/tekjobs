/** Where to go after sign-in. Only a path on this site, never the login page itself; otherwise the employer's home. */
export const HOME_SIGNED_IN = "/app/post-a-job";

export function safeNext(raw: string | undefined | null): string {
  if (!raw || !/^\/[a-z0-9\-/?=&%._~]*$/i.test(raw) || raw.startsWith("//") || raw.startsWith("/login") || raw.startsWith("/api/")) return HOME_SIGNED_IN;
  return raw;
}
