import { expect, test } from "./fixtures";

async function advance(page: import("@playwright/test").Page, count: number): Promise<void> {
  const next = page.getByRole("button", { name: "Next Step", exact: true });
  for (let index = 0; index < count && await next.isEnabled(); index += 1) await next.click();
}

test("Focus does not accumulate historical messages", async ({ page, assertNoBrowserErrors }) => {
  await page.goto("/#/simulator");
  await page.getByLabel("Scenario").selectOption("basic-leader-election");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await advance(page, 3);
  const firstId = await page.locator("g[data-message-id]").first().getAttribute("data-message-id");
  expect(firstId).not.toBeNull();
  let disappeared = false;
  for (let index = 0; index < 24 && await page.getByRole("button", { name: "Next Step", exact: true }).isEnabled(); index += 1) {
    await page.getByRole("button", { name: "Next Step", exact: true }).click();
    if (await page.locator(`g[data-message-id="${firstId}"]`).count() === 0) { disappeared = true; break; }
  }
  expect(disappeared).toBe(true);
  await expect(page.getByTestId("action-summary")).toContainText("Step");
  assertNoBrowserErrors();
});

test("Context and All expose progressively more messages", async ({ page, assertNoBrowserErrors }) => {
  await page.goto("/#/simulator");
  await advance(page, 12);
  const count = async () => Number((await page.getByTestId("visible-message-count").textContent())?.match(/^\d+/)?.[0] ?? 0);
  await page.getByRole("radio", { name: "Show messages from the current action" }).click();
  const focus = await count();
  await page.getByRole("radio", { name: "Show messages from the last three actions" }).click();
  const context = await count();
  await page.getByRole("radio", { name: "Show all messages in the current snapshot" }).click();
  const all = await count();
  expect(all).toBeGreaterThanOrEqual(context);
  expect(context).toBeGreaterThanOrEqual(focus);
  assertNoBrowserErrors();
});

test("Time travel never reveals future message activity", async ({ page, assertNoBrowserErrors }) => {
  await page.goto("/#/simulator");
  const next = page.getByRole("button", { name: "Next Step", exact: true });
  for (let index = 0; index < 500 && await next.isEnabled(); index += 1) await next.click();
  const slider = page.getByLabel("Current Action Step");
  await slider.fill("2");
  await page.getByRole("radio", { name: "Show all messages in the current snapshot" }).click();
  const futureSteps = await page.locator("g[data-message-id]").evaluateAll((groups) => groups.map((group) => Number(group.getAttribute("data-activity-step"))).filter((step) => Number.isFinite(step) && step > 2));
  expect(futureSteps).toEqual([]);
  await page.getByRole("radio", { name: "Show messages from the current action" }).click();
  await expect(page.getByTestId("visible-message-count")).toBeVisible();
  assertNoBrowserErrors();
});

test("Request and response routes use distinct deterministic paths", async ({ page, assertNoBrowserErrors }) => {
  await page.goto("/#/simulator");
  await advance(page, 20);
  await page.getByRole("radio", { name: "Show all messages in the current snapshot" }).click();
  const routePairs = await page.locator("g[data-message-id]").evaluateAll((groups) => {
    const routes = new Map<string, string[]>();
    for (const group of groups) {
      const from = group.getAttribute("data-from"); const to = group.getAttribute("data-to");
      const path = group.querySelector('path[data-route-path="visual"]')?.getAttribute("d");
      if (!from || !to || !path) continue;
      const key = [from, to].sort().join("|");
      routes.set(key, [...(routes.get(key) ?? []), `${from}>${to}:${path}`]);
    }
    return [...routes.values()];
  });
  const hasDistinctReverse = routePairs.some((routes) => {
    const directions = new Map<string, string>();
    for (const route of routes) { const [direction, path] = route.split(":", 2); directions.set(direction, path); }
    for (const [direction, path] of directions) {
      const [from, to] = direction.split(">");
      if (directions.get(`${to}>${from}`) && directions.get(`${to}>${from}`) !== path) return true;
    }
    return false;
  });
  expect(hasDistinctReverse).toBe(true);
  assertNoBrowserErrors();
});
