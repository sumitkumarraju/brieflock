import { expect, test } from "@playwright/test";

test("client verifies, approves, releases, and inspects attacks", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Approve the work. Bind the payment." })).toBeVisible();
  const openNavigation = page.getByRole("button", { name: "Open navigation" });
  if (await openNavigation.isVisible()) await openNavigation.click();
  await page.getByRole("button", { name: "Delivery review", exact: true }).click();
  await page.getByRole("button", { name: "Verify demo fixture bytes" }).click();
  await expect(page.getByText("Exact bytes match")).toBeVisible();
  await page.getByRole("button", { name: "Approve this exact version" }).click();
  const openNavigationAgain = page.getByRole("button", { name: "Open navigation" });
  if (await openNavigationAgain.isVisible()) await openNavigationAgain.click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Release payout" }).click();
  await expect(page.getByText("Payout confirmed in simulation", { exact: true })).toBeVisible();
  const openNavigationForAttacks = page.getByRole("button", { name: "Open navigation" });
  if (await openNavigationForAttacks.isVisible()) await openNavigationForAttacks.click();
  await page.getByRole("button", { name: "Attack Lab", exact: true }).click();
  await page.getByRole("button", { name: "Run all checks" }).click();
  await expect(page.locator(".scenario-number.passed")).toHaveCount(6);
});

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const widths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
});

test("creates a simulation commission and commits its first delivery", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New commission" }).click();
  await expect(page.getByRole("heading", { name: "Fund a protected milestone." })).toBeVisible();
  await page.getByRole("button", { name: "Create in simulation" }).click();
  await expect(page.getByText("Submit the first delivery")).toBeVisible();
  await page.getByRole("button", { name: "Submit delivery v1" }).click();
  await expect(page.getByRole("main").getByText("Awaiting approval")).toBeVisible();
});

test("commits the selected local bytes for a new commission", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New commission" }).click();
  await page.getByRole("button", { name: "Create in simulation" }).click();
  const openNavigation = page.getByRole("button", { name: "Open navigation" });
  if (await openNavigation.isVisible()) await openNavigation.click();
  await page.getByRole("button", { name: "Delivery review", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "selected-delivery.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("BriefLock selected delivery bytes"),
  });
  await expect(page.getByRole("button", { name: "Commit selected file as delivery v1" })).toBeVisible();
  await page.getByRole("button", { name: "Commit selected file as delivery v1" }).click();
  await expect(page.getByText("Awaiting approval").last()).toBeVisible();
});
