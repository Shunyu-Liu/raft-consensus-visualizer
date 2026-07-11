import { expect, test as base } from "@playwright/test";

export const test = base.extend<{ assertNoBrowserErrors: () => void }>({
  assertNoBrowserErrors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
    });
    page.on("requestfailed", (request) => errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`));
    await provide(() => expect(errors, errors.join("\n")).toEqual([]));
    expect(errors, errors.join("\n")).toEqual([]);
  },
});

export { expect } from "@playwright/test";

export async function drainScenario(page: import("@playwright/test").Page): Promise<void> {
  const next = page.getByRole("button", { name: "Next Step", exact: true });
  for (let count = 0; count < 500 && await next.isEnabled(); count += 1) await next.click();
  await expect(next).toBeDisabled();
}
