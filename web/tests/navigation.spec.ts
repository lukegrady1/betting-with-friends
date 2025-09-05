import { test, expect } from '@playwright/test';

test.describe('Navigation and UI', () => {
  test('should have mobile-first responsive design', async ({ page }) => {
    await page.goto('/auth/signin');

    // Check mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    // Check that elements are properly sized for mobile
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();

    // Check that text is readable on mobile
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
  });

  test('should display loading states correctly', async ({ page }) => {
    await page.goto('/auth/signin');

    // Mock a slow response to test loading state
    await page.route('**/auth/v1/otp', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      });
    });

    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    // Should show loading spinner
    await expect(page.locator('.loading-spinner')).toBeVisible();
  });

  test('should have proper button styling and hover effects', async ({ page }) => {
    await page.goto('/auth/signin');

    const submitButton = page.locator('button[type="submit"]');
    
    // Check button has gradient styling
    const buttonClasses = await submitButton.getAttribute('class');
    expect(buttonClasses).toContain('btn-primary');
    
    // Check button is properly rounded
    expect(buttonClasses).toContain('rounded-xl');
  });

  test('should display proper card styling', async ({ page }) => {
    await page.goto('/auth/signin');

    const card = page.locator('.card').first();
    await expect(card).toBeVisible();
    
    // Check card has proper styling classes
    const cardClasses = await card.getAttribute('class');
    expect(cardClasses).toContain('rounded-2xl');
    expect(cardClasses).toContain('shadow-lg');
  });

  test('should have accessible form elements', async ({ page }) => {
    await page.goto('/auth/signin');

    // Check form accessibility
    const emailInput = page.locator('input[type="email"]');
    const emailLabel = page.locator('label[for="email"]');
    
    await expect(emailLabel).toBeVisible();
    await expect(emailLabel).toContainText('Email Address');
    await expect(emailInput).toHaveAttribute('required');
    await expect(emailInput).toHaveAttribute('placeholder');
  });
});