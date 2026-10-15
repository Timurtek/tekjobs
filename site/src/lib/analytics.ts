/**
 * PostHog for the marketing site: the open-source funnel (visited, read the docs, copied the install, clicked
 * through to GitHub, a release or Discussions). This file is the whole client and imports nothing, so the root test
 * suite can drive it in Node (test/site-analytics.test.mjs); components/Analytics.tsx hands it the browser.
 *
 * It sends to PostHog's public capture endpoint and nothing else: no autocapture, no session recording, no cookies,
 * no person profiles. The id is random per browser tab and lives in sessionStorage, so it ends when the tab closes.
 * Do Not Track and Global Privacy Control switch it off. The TekJobs software never loads any of this.
 */

export const APP = "TekJobs site";

const REPO = "https://github.com/Timurtek/tekjobs";
const NPM = "https://www.npmjs.com/package/@timurtekb/tekjobs";
const PACKAGE = "@timurtekb/tekjobs";
const ID_KEY = "tekjobs-ph-id";

export type Properties = Record<string, string | number | boolean | null>;

export type Capture = { event: string; properties: Properties };

export interface Browser {
  /** POSTs one JSON body; failures are the sender's to swallow, analytics must never break the page. */
  send: (url: string, body: string) => void;
  storage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void } | null;
  randomId: () => string;
  /** navigator.doNotTrack, window.doNotTrack, navigator.globalPrivacyControl, as the browser reports them. */
  doNotTrack: unknown[];
  /** The page, without its query string or hash: those can carry things nobody agreed to send. */
  location: { origin: string; pathname: string };
  referrer: string;
}

export function doNotTrack(signals: unknown[]): boolean {
  return signals.some((s) => s === "1" || s === "yes" || s === true);
}

/** The click events the funnel counts, from a link's href. Anything else is not counted. */
export function classifyLink(href: string): Capture | null {
  let url: URL;
  try { url = new URL(href); } catch { return null; }
  const link = `${url.origin}${url.pathname}`.replace(/\/$/, "");
  if (link === NPM) return { event: "release_clicked", properties: { target: "npm", url: link } };
  if (link !== REPO && !link.startsWith(`${REPO}/`)) return null;
  const rest = link.slice(REPO.length);
  if (rest.startsWith("/discussions")) return { event: "discussions_clicked", properties: { url: link } };
  if (rest.startsWith("/releases")) return { event: "release_clicked", properties: { target: "github", url: link } };
  return { event: "github_clicked", properties: { url: link } };
}

/** A copied snippet counts as the install when it is the command that installs the package. */
export function isInstallCommand(code: string): boolean {
  return code.includes(PACKAGE) && /\b(npx|npm|pnpm|yarn|bunx?)\b/.test(code);
}

/** The doc a pathname is on, or null when it is not a docs page. */
export function docSlug(pathname: string): string | null {
  const m = /^\/docs\/([^/]+)\/?$/.exec(pathname);
  return m ? m[1]! : null;
}

/** The events a page view sends: always `$pageview`, and `docs_viewed` on a docs page. */
export function pageViewEvents(pathname: string): Capture[] {
  const slug = docSlug(pathname);
  return [
    { event: "$pageview", properties: {} },
    ...(slug ? [{ event: "docs_viewed", properties: { doc: slug } }] : []),
  ];
}

/** Where a visitor came from, as a site only: a referring URL's path and query can name a person or a search. */
export function referrerOrigin(referrer: string): string {
  try { return new URL(referrer).origin; } catch { return "$direct"; }
}

export interface Analytics {
  enabled: boolean;
  capture: (event: string, properties?: Properties) => void;
}

/**
 * Returns a no-op unless there is a key and the browser has not asked not to be tracked. Every event carries
 * `app: "TekJobs site"`, the page, and `$process_person_profile: false`, so PostHog keeps no profile of anyone.
 */
export function createAnalytics(config: { key: string; host: string }, browser: Browser): Analytics {
  if (!config.key || !config.host || doNotTrack(browser.doNotTrack)) return { enabled: false, capture: () => {} };
  const endpoint = `${config.host.replace(/\/$/, "")}/i/v0/e/`;
  let id: string | null = null;
  try { id = browser.storage?.getItem(ID_KEY) ?? null; } catch { /* storage blocked: a fresh id per page */ }
  if (!id) {
    id = browser.randomId();
    try { browser.storage?.setItem(ID_KEY, id); } catch { /* as above */ }
  }
  const distinctId = id;
  return {
    enabled: true,
    capture(event, properties = {}) {
      const { origin, pathname } = browser.location;
      const body = {
        api_key: config.key,
        event,
        distinct_id: distinctId,
        timestamp: new Date().toISOString(),
        properties: {
          ...properties,
          app: APP,
          $current_url: `${origin}${pathname}`,
          $pathname: pathname,
          $referrer: referrerOrigin(browser.referrer),
          $process_person_profile: false,
        },
      };
      browser.send(endpoint, JSON.stringify(body));
    },
  };
}
