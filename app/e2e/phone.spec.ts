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

test("Pipeline is one stage at a time, and a card moves through its menu", async ({ page }) => {
  await open(page, "pipeline");
  await expect(page.locator(".z-kanban")).toHaveCount(0);
  const stages = page.getByRole("tablist", { name: "Pipeline stages" });
  await expect(stages).toBeVisible();
  const reviewing = page.getByRole("tabpanel").locator(".pipeline-stage li");
  const before = await reviewing.count();
  test.skip(before === 0, "the sample vault has nothing in reviewing");
  await reviewing.first().getByRole("button", { name: /^Move / }).tap();
  await page.getByRole("menuitem", { name: "Move to applying" }).tap();
  await expect(reviewing).toHaveCount(before - 1);
  await stages.getByRole("tab", { name: /Applying/ }).tap();
  await expect(page.getByRole("tabpanel").locator(".pipeline-stage li").first()).toBeVisible();
});

test("Jobs keeps its views and filters in a sheet behind one Filters button", async ({ page }) => {
  await open(page, "jobs");
  await expect(page.locator(".main .views")).toHaveCount(0);
  await expect(page.locator(".main .filters")).toHaveCount(0);
  await page.getByRole("button", { name: /^Filters/ }).tap();
  const sheet = page.getByRole("dialog", { name: "Views and filters" });
  await expect(sheet.getByLabel("Search")).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Show \d+ match/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe("INPUT");
  await sheet.getByRole("button", { name: /^Show \d+ match/ }).tap();
  await expect(sheet).toHaveCount(0);
});

test("growing the window from phone to desktop switches the layout live", async ({ page }) => {
  await open(page, "pipeline");
  await expect(page.getByRole("navigation", { name: "Pages" }).getByRole("button", { name: "More" })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".z-tabbar")).toHaveCount(0);
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".z-kanban")).toBeVisible();
});

// Text at 200% (Apple HIG: support at least 200% enlargement; WCAG 1.4.4): the root size doubles, every rem with it.
// Nothing may scroll sideways, and no text box may cut off its own words, except the single lines that end in an
// ellipsis on purpose.
async function textAt200(page: Page) {
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.waitForTimeout(150);
  return page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>("[role=dialog]");
    const page = document.documentElement;
    const overflow = sheet ? sheet.scrollWidth - sheet.clientWidth : Math.max(page.scrollWidth, document.body.scrollWidth) - page.clientWidth;
    const clipped = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((e) => {
        const s = getComputedStyle(e);
        if (s.textOverflow === "ellipsis" || e.closest("[role=tablist], .z-tabbar, svg")) return false;
        // Visually hidden on purpose (screen-reader text, a stacked table's header row).
        const box = e.getBoundingClientRect();
        if (box.width <= 1 || box.height <= 1 || s.clipPath !== "none" || s.clip !== "auto") return false;
        if (!/hidden|clip/.test(s.overflowX + s.overflowY) || !e.textContent?.trim() || e.getBoundingClientRect().width === 0) return false;
        return e.scrollWidth - e.clientWidth > 2 || e.scrollHeight - e.clientHeight > 2;
      })
      .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`);
    return { overflow, clipped: [...new Set(clipped)].slice(0, 8) };
  });
}

for (const name of PAGES) {
  test(`${name} at 200% text: nothing sideways, nothing clipped`, async ({ page }) => {
    await open(page, name);
    const { overflow, clipped } = await textAt200(page);
    expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(0);
    expect(clipped, "text cut off by its box").toEqual([]);
  });
}

test("the job sheet at 200% text: nothing sideways, nothing clipped", async ({ page }) => {
  await open(page, "jobs");
  await page.locator(".jobs-narrow tbody tr[data-interactive]").first().tap();
  await expect(page.getByRole("dialog").getByRole("tab", { name: "Match reasons" })).toBeVisible();
  const { overflow, clipped } = await textAt200(page);
  expect(overflow, "sheet scrolls sideways").toBeLessThanOrEqual(0);
  expect(clipped, "text cut off by its box").toEqual([]);
});

test("the job sheet keeps its controls in a sticky top bar, and the name moves into it on scroll", async ({ page }) => {
  await open(page, "jobs");
  await page.locator(".jobs-narrow tbody tr[data-interactive]").first().tap();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("tab", { name: "Match reasons" })).toBeVisible();
  expect(await sheet.evaluate((s) => s.scrollWidth - s.clientWidth), "sheet scrolls sideways").toBeLessThanOrEqual(0);
  await expect(sheet.getByLabel("Status")).toBeInViewport();
  await sheet.evaluate((s) => (s.scrollTop = s.scrollHeight));
  await expect(sheet.locator(".sheet-nav__title")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Close" })).toBeInViewport();
  await expect(sheet.getByRole("tab", { name: "Match reasons" })).toBeInViewport();
  await sheet.getByRole("button", { name: "Close" }).tap();
  await expect(sheet).toHaveCount(0);
});
