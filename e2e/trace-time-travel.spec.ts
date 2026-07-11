import { drainScenario, expect, test } from "./fixtures";

test("exports, validates, imports, and replays a trace", async ({ page, assertNoBrowserErrors }) => {
  await page.goto("/#/simulator");
  await drainScenario(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Trace" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("raft-explorer-basic-leader-election-trace.json");
  const path = await download.path();
  expect(path).not.toBeNull();
  const input = page.locator('input[type="file"][accept="application/json,.json"]');
  await input.setInputFiles(path!);
  await expect(page.getByText("Imported and replayed", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Replay Trace" }).click();
  await expect(page.getByText("matched the recorded final state", { exact: false })).toBeVisible();
  assertNoBrowserErrors();
});

test("time travel replays history and returns to live state", async ({ page, assertNoBrowserErrors }) => {
  await page.goto("/#/simulator");
  await drainScenario(page);
  await expect(page.getByRole("button", { name: /Node B.*leader/i })).toBeVisible();
  const slider = page.getByLabel("Current Action Step");
  await slider.fill("0");
  await expect(page.getByText("Viewing history", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Node B.*follower/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit to Leader" })).toBeDisabled();
  await slider.fill("5");
  await expect(page.getByRole("button", { name: /Node B.*leader/i })).toBeVisible();
  await page.getByRole("button", { name: "Return to Live State" }).click();
  await expect(page.getByText("Viewing history", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Node B.*leader/i })).toBeVisible();
  assertNoBrowserErrors();
});
