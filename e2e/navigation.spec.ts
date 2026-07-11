import { expect, test } from "./fixtures";

test("Simulator and Learn routes render and navigate without browser errors", async ({ page, assertNoBrowserErrors }) => {
  await page.goto("/#/simulator");
  await expect(page.getByRole("heading", { name: "Simulator", exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toBeEmpty();
  await page.getByRole("button", { name: "Learn", exact: true }).click();
  await expect(page).toHaveURL(/#\/learn$/);
  await expect(page.getByRole("heading", { name: "Learn Raft" })).toBeVisible();
  await page.getByRole("button", { name: "Simulator", exact: true }).click();
  await expect(page).toHaveURL(/#\/simulator$/);
  assertNoBrowserErrors();
});

test("mobile dark reduced-motion smoke", async ({ page, assertNoBrowserErrors }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/simulator");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("[data-theme=dark]")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verification & Replay" })).toBeVisible();
  assertNoBrowserErrors();
});
