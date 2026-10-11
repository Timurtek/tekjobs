// Text contrast (Apple HIG and WCAG AA: 4.5:1 for text up to 17pt, 3:1 for larger or bold), checked by axe on every
// page in both appearances, at desktop and phone width, with a job note open as well.
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["today", "overview", "jobs", "pipeline", "mail", "calendar", "people", "companies", "criteria", "profile", "runs", "agent", "settings"];

async function failures(page: Page) {
  await page.waitForTimeout(300);
  const r = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  return r.violations.flatMap((v) => v.nodes.map((n) => {
    const d = n.any[0]?.data as { contrastRatio?: number; fgColor?: string; bgColor?: string } | undefined;
    return `${n.target.join(" ")} ${d?.contrastRatio}:1 (${d?.fgColor} on ${d?.bgColor})`;
  }));
}

for (const scheme of ["dark", "light"] as const) {
  for (const [label, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 375, height: 812 }]] as const) {
    test.describe(`${scheme}, ${label}`, () => {
      test.use({ viewport, colorScheme: scheme });

      for (const name of PAGES) {
        test(`${name}: every text passes contrast`, async ({ page }) => {
          await page.goto(`/#/${name}`);
          await page.waitForLoadState("networkidle");
          expect(await failures(page)).toEqual([]);
        });
      }

      test("an open job note: every text passes contrast", async ({ page }) => {
        await page.goto("/#/jobs");
        await page.waitForLoadState("networkidle");
        await page.locator("tbody tr[data-interactive]").first().click();
        await expect(page.getByRole("tab", { name: "Match reasons" })).toBeVisible();
        expect(await failures(page)).toEqual([]);
      });
    });
  }
}
