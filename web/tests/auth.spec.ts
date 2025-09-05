import { test, expect } from "@playwright/test";

test.describe("Sign In", () => {
  test("renders exactly once and has theme colors", async ({ page }) => {
    await page.goto("http://localhost:5179/auth/signin");

    const cards = page.getByTestId("signin-card");
    await expect(cards).toHaveCount(1); // no duplicates

    // Theme variable present (primary ring)
    const hasVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ring").trim().length > 0);
    expect(hasVar).toBeTruthy();

    // Email input present and enabled
    await expect(page.getByTestId("email-input")).toBeVisible();
  });

  test("shows spinner during route change", async ({ page }) => {
    await page.goto("http://localhost:5178/");
    // Trigger route change that would display spinner in your app
    await page.evaluate(() => window.dispatchEvent(new Event("app:start-loading")));
    await expect(page.getByTestId("spinner")).toBeVisible();
  });

  test('should show validation for empty email', async ({ page }) => {
    await page.goto('/auth/signin');

    // Try to submit without email
    await page.click('button[type="submit"]');
    
    // Should not allow submission (button should be disabled)
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('should show loading state when submitting email', async ({ page }) => {
    await page.goto('/auth/signin');

    // Enter email and submit
    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    // Should show loading state
    await expect(page.locator('button[type="submit"]')).toContainText('Sending Magic Link...');
  });

  test('should display success message after email submission', async ({ page }) => {
    await page.goto('/auth/signin');

    // Mock the Supabase auth call to return success
    await page.route('**/auth/v1/otp', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      });
    });

    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator('.alert-success')).toContainText('Check your email for the sign-in link!');
  });
});