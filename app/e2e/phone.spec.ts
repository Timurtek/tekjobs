// The app on a phone (Apple HIG, compact width), against the same copy of the fictional sample vault: a tab bar at
// the bottom and no sidebar, no page wider than the screen, no input small enough to make iOS zoom, the rest of the
// pages behind More, and a job card that opens its sheet.
import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

const PAGES = ["today", "overview", "jobs", "pipeline", "mail", "calendar", "people", "companies", "criteria", "profile", "runs", "agent", "settings"];

async function open(page: Page, name: string) {
  await page.goto(`/#/${name}`);
  await page.waitForLoadState("networkidle");
}

test("the tab bar replaces the sidebar, and More holds the other pages", async ({ page }) => {
  await open(page, "today");
  const tabs = page.getByRole("navigation", { name: "Pages" });
  await expect(tabs).toBeVisible();
  for (const label of ["Today", "Jobs", "Pipeline", "Mail", "More"]) await expect(tabs.getByRole("button", { name: label })).toBeVisible();
  await expect(page.locator(".sidebar:not(.sidebar--sheet)")).toHaveCount(0);
  await tabs.getByRole("button", { name: "More" }).tap();
  const sheet = page.getByRole("dialog", { name: "More" });
  await expect(sheet.getByRole("button", { name: "Sources" })).toBeVisible();
  await sheet.getByRole("button", { name: "Sources" }).tap();
  await expect(page).toHaveURL(/#\/companies/);
});

for (const name of PAGES) {
  test(`${name}: nothing wider than the screen, no input under 16px`, async ({ page }) => {
    await open(page, name);
    const { overflow, smallInputs } = await page.evaluate(() => ({
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
      smallInputs: [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]), select, textarea")]
        .filter((e) => e.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(e).fontSize) < 16).length,
    }));
    expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(0);
    expect(smallInputs, "inputs that make iOS zoom on focus").toBe(0);
  });
}

test("a job card opens its sheet, and the section tabs stay on one line", async ({ page }) => {
  await open(page, "jobs");
  await page.locator(".jobs-narrow tbody tr[data-interactive]").first().tap();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("tab", { name: "Match reasons" })).toBeVisible();
  const rows = await sheet.locator(".z-tabs__list").first().evaluate((l) => new Set([...l.children].map((c) => Math.round(c.getBoundingClientRect().top))).size);
  expect(rows, "tab rows").toBe(1);
});
