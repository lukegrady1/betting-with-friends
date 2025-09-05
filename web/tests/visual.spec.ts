import { test, expect } from '@playwright/test';

test.describe('Visual Design and Styling', () => {
  test('should have proper gradient backgrounds', async ({ page }) => {
    await page.goto('/auth/signin');

    // Check body has gradient background
    const body = page.locator('body');
    const bodyStyles = await body.evaluate(el => getComputedStyle(el).backgroundImage);
    expect(bodyStyles).toContain('gradient');
  });

  test('should have glass morphism effects on cards', async ({ page }) => {
    await page.goto('/auth/signin');

    const card = page.locator('.card').first();
    await expect(card).toBeVisible();

    // Check card has backdrop blur and transparency
    const cardStyles = await card.evaluate(el => {
      const styles = getComputedStyle(el);
      return {
        backdropFilter: styles.backdropFilter,
        backgroundColor: styles.backgroundColor
      };
    });

    expect(cardStyles.backdropFilter).toContain('blur');
  });

  test('should have hover effects on interactive elements', async ({ page }) => {
    await page.goto('/auth/signin');

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();

    // Hover over button and check for transform/scale effects
    await submitButton.hover();
    
    // The button should have transition classes
    const buttonClasses = await submitButton.getAttribute('class');
    expect(buttonClasses).toContain('transition-all');
    expect(buttonClasses).toContain('hover:scale-');
  });

  test('should have proper typography hierarchy', async ({ page }) => {
    await page.goto('/auth/signin');

    // Check main heading
    const mainHeading = page.locator('h1');
    await expect(mainHeading).toBeVisible();
    
    const headingStyles = await mainHeading.evaluate(el => {
      const styles = getComputedStyle(el);
      return {
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        background: styles.background
      };
    });

    // Should be large and bold
    expect(parseFloat(headingStyles.fontSize)).toBeGreaterThan(24); // Should be at least 24px
    expect(parseInt(headingStyles.fontWeight)).toBeGreaterThan(600); // Should be bold
  });

  test('should have proper spacing and layout', async ({ page }) => {
    await page.goto('/auth/signin');

    // Check form spacing
    const form = page.locator('form');
    await expect(form).toBeVisible();

    const formStyles = await form.evaluate(el => {
      const styles = getComputedStyle(el);
      return {
        gap: styles.gap,
        padding: styles.padding
      };
    });

    // Should have proper spacing between form elements
    expect(formStyles.gap).toBeTruthy();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Test iPhone SE size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/auth/signin');

    // Check that content is properly contained
    const container = page.locator('.max-w-md');
    await expect(container).toBeVisible();

    // Check that buttons are properly sized for touch
    const submitButton = page.locator('button[type="submit"]');
    const buttonBox = await submitButton.boundingBox();
    
    if (buttonBox) {
      // Touch targets should be at least 44px high
      expect(buttonBox.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('should have proper focus states for accessibility', async ({ page }) => {
    await page.goto('/auth/signin');

    const emailInput = page.locator('input[type="email"]');
    
    // Focus the input
    await emailInput.focus();

    // Check input has focus ring styles
    const inputClasses = await emailInput.getAttribute('class');
    expect(inputClasses).toContain('focus:ring-');
    expect(inputClasses).toContain('focus:border-');
  });

  test('should have consistent color scheme', async ({ page }) => {
    await page.goto('/auth/signin');

    // Check that blue/indigo gradient colors are used consistently
    const gradientElements = page.locator('[class*="blue-6"], [class*="indigo-6"]');
    const count = await gradientElements.count();
    
    // Should have multiple elements using the brand colors
    expect(count).toBeGreaterThan(0);
  });

  test('should have loading animations', async ({ page }) => {
    await page.goto('/auth/signin');

    // Mock a slow response to see loading state
    await page.route('**/auth/v1/otp', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      });
    });

    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    // Check loading spinner appears and has animation
    const spinner = page.locator('.loading-spinner');
    await expect(spinner).toBeVisible();
    
    const spinnerClasses = await spinner.getAttribute('class');
    expect(spinnerClasses).toContain('animate-spin');
  });
});