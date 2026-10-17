"use client";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import { classifyLink, createAnalytics, isInstallCommand, pageViewEvents, type Analytics as Client } from "@/lib/analytics";
import { posthog } from "@/lib/flags";

function browserClient(): Client {
  return createAnalytics(posthog, {
    send: (url, body) => {
      // keepalive lets the request finish when the click leaves the page.
      fetch(url, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => { /* not counted, page unaffected */ });
    },
    storage: (() => { try { return window.sessionStorage; } catch { return null; } })(),
    randomId: () => crypto.randomUUID(),
    doNotTrack: [navigator.doNotTrack, (window as { doNotTrack?: unknown }).doNotTrack, (navigator as { globalPrivacyControl?: unknown }).globalPrivacyControl],
    location: window.location,
    referrer: document.referrer,
  });
}

/**
 * PostHog for the open-source funnel; renders nothing. One page view per path, and one click listener for the
 * whole document: links to the repo, its releases, npm and Discussions, and the copy button on a code block that
 * holds the install command. Off unless flags.ts has a key, which it has only in production.
 */
export function Analytics() {
  const pathname = usePathname();
  const client = useMemo(() => (posthog.key && typeof window !== "undefined" ? browserClient() : null), []);

  useEffect(() => {
    if (!client?.enabled || !pathname) return;
    for (const { event, properties } of pageViewEvents(pathname)) client.capture(event, properties);
  }, [client, pathname]);

  useEffect(() => {
    if (!client?.enabled) return;
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const link = e.target.closest("a[href]");
      if (link instanceof HTMLAnchorElement) {
        const hit = classifyLink(link.href);
        if (hit) client.capture(hit.event, hit.properties);
        return;
      }
      const copy = e.target.closest(".z-codeblock__copy");
      const code = copy?.closest(".z-codeblock")?.querySelector("code")?.textContent ?? "";
      if (copy && isInstallCommand(code)) client.capture("install_copied", {});
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [client]);

  return null;
}
