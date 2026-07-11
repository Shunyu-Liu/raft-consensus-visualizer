import { expect, test } from "./fixtures";

const scenarios = [
  ["basic-leader-election", "B"],
  ["leader-failure", "C"],
  ["split-vote", "A"],
  ["network-partition", "C"],
  ["conflicting-logs", "C"],
] as const;

for (const [scenarioId, expectedLeader] of scenarios) {
  test(`${scenarioId} runs through the browser`, async ({ page, assertNoBrowserErrors }) => {
    await page.goto("/#/simulator");
    await page.getByLabel("Scenario").selectOption(scenarioId);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.getByRole("button", { name: "Next Step", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Event Timeline" }).locator("..")).not.toContainText("No events yet");
    await page.getByLabel("Speed").fill("2");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByRole("button", { name: "Next Step", exact: true })).toBeDisabled({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: new RegExp(`Node ${expectedLeader}.*leader`, "i") })).toBeVisible();
    assertNoBrowserErrors();
  });
}
