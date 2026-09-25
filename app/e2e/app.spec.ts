import { expect, test } from "@playwright/test";

// The app on the fictional sample vault: Jordan Example, three weeks into a search.

test("Today shows the decision queue with the day's date", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /\w+day, \w+ \d+/ })).toBeVisible();
  await expect(page.getByText("Decide on these")).toBeVisible();
  await expect(page.getByRole("button", { name: "Shortlist" }).first()).toBeVisible();
});

test("Jobs lists the notes, opens one with its match reasons, and the People tab answers", async ({ page }) => {
  await page.goto("/#/jobs");
  const rows = page.locator(".clist li, tbody tr");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(5);
  await rows.first().click();
  await expect(page.getByRole("tab", { name: "Match reasons" })).toBeVisible();
  await expect(page.getByText(/Scored \d+ of \d+ possible/)).toBeVisible();
  await page.getByRole("tab", { name: "People" }).click();
  await expect(page.getByText(/No one on this thread yet|People ↗/).first()).toBeVisible();
});

test("the copy panel opens, lists the identity lines, and never scrolls sideways", async ({ page }) => {
  await page.goto("/#/jobs");
  await page.getByRole("button", { name: "Copy panel" }).click();
  await expect(page.getByPlaceholder("Find, then Enter copies the first")).toBeVisible();
  await expect(page.getByText("Full name")).toBeVisible();
  const overflow = await page.locator(".copy__groups").evaluate((el) => ({ x: el.scrollWidth > el.clientWidth, ox: getComputedStyle(el).overflowX }));
  expect(overflow.x).toBe(false);
  expect(overflow.ox).toBe("hidden");
});

test("People has the LinkedIn import card, Sources has boards, Criteria has the bar", async ({ page }) => {
  await page.goto("/#/people");
  await expect(page.getByRole("heading", { name: "Bring your LinkedIn history" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview" })).toBeDisabled();
  await page.goto("/#/companies");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await page.goto("/#/criteria");
  await expect(page.getByText(/minScore|The bar|Bar/).first()).toBeVisible();
});

test("the API behind the app answers, and an unknown route is a JSON 404", async ({ request }) => {
  const summary = await request.get("/api/summary");
  expect(summary.ok()).toBe(true);
  const nope = await request.get("/api/nothing");
  expect(nope.status()).toBe(404);
  expect((await nope.json()).error).toMatch(/no route/);
});
