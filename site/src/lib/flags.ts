/**
 * What is switched on, read from the environment. Everything here degrades to "off" when its keys are absent,
 * so the site builds and runs as a landing page and docs with no Firebase project and no Stripe account.
 */
export const authConfigured = !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_APP_ID);

/** Job posting goes on sale only when this says so, whatever keys exist. */
export const purchasesOpen = process.env.NEXT_PUBLIC_PURCHASES_OPEN === "1";

export const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://tekjobs.timurtek.com";

/**
 * Google Analytics 4 on the marketing site, production deployments only: not in development, not on preview
 * URLs, so local work and pull-request builds never count. The measurement id is public by nature (it ships in
 * the page), so it lives here rather than in the environment. Empty string means the tag is not rendered.
 */
export const analyticsId = process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "G-DX8B8DCTGF" : "";
