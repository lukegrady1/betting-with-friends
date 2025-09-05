import { test, expect } from '@playwright/test';

test.describe('League Management', () => {
  // Mock authenticated state for league tests
  test.beforeEach(async ({ page }) => {
    // Mock Supabase session
    await page.addInitScript(() => {
      // Mock localStorage to simulate authenticated user
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: 'mock-user-id', email: 'test@example.com' }
      }));
    });

    // Mock Supabase auth response
    await page.route('**/auth/v1/user', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'mock-user-id', email: 'test@example.com' }
        })
      });
    });
  });

  test('should display leagues page when authenticated', async ({ page }) => {
    // Mock leagues API response
    await page.route('**/rest/v1/leagues*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: '1',
            name: 'Test League',
            invite_code: 'ABC123',
            created_by: 'mock-user-id',
            created_at: '2024-01-01T00:00:00Z'
          }
        ])
      });
    });

    await page.goto('/');

    // Should redirect to leagues page
    await expect(page).toHaveURL(/\/leagues/);
    
    // Check for leagues page elements
    await expect(page.locator('h1')).toContainText('My Leagues');
    await expect(page.locator('text=Test League')).toBeVisible();
    await expect(page.locator('text=ABC123')).toBeVisible();
  });

  test('should display empty state when no leagues exist', async ({ page }) => {
    // Mock empty leagues response
    await page.route('**/rest/v1/leagues*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('/leagues');

    // Should show empty state
    await expect(page.locator('text=No leagues yet')).toBeVisible();
    await expect(page.locator('text=Create a new league or join an existing one')).toBeVisible();
  });

  test('should navigate to create league page', async ({ page }) => {
    await page.route('**/rest/v1/leagues*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('/leagues');

    // Click create league button
    await page.click('button:has-text("Create New League")');

    // Should navigate to create page
    await expect(page).toHaveURL(/\/leagues\/create/);
  });

  test('should navigate to join league page', async ({ page }) => {
    await page.route('**/rest/v1/leagues*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('/leagues');

    // Click join league button
    await page.click('button:has-text("Join Existing League")');

    // Should navigate to join page
    await expect(page).toHaveURL(/\/leagues\/join/);
  });

  test('should navigate to league home when clicking league card', async ({ page }) => {
    // Mock leagues API response
    await page.route('**/rest/v1/leagues*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'league-123',
            name: 'Test League',
            invite_code: 'ABC123',
            created_by: 'mock-user-id',
            created_at: '2024-01-01T00:00:00Z'
          }
        ])
      });
    });

    await page.goto('/leagues');

    // Wait for league to load
    await expect(page.locator('text=Test League')).toBeVisible();

    // Click on league card
    await page.click('.card:has-text("Test League")');

    // Should navigate to league home page
    await expect(page).toHaveURL(/\/leagues\/league-123/);
  });

  test('should display proper league card styling', async ({ page }) => {
    await page.route('**/rest/v1/leagues*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: '1',
            name: 'Test League',
            invite_code: 'ABC123',
            created_by: 'mock-user-id',
            created_at: '2024-01-01T00:00:00Z'
          }
        ])
      });
    });

    await page.goto('/leagues');

    // Wait for league card to appear
    const leagueCard = page.locator('.card').first();
    await expect(leagueCard).toBeVisible();

    // Check league card has proper styling
    await expect(leagueCard).toHaveClass(/cursor-pointer/);
    
    // Check league card contains expected elements
    await expect(leagueCard.locator('text=Test League')).toBeVisible();
    await expect(leagueCard.locator('text=ABC123')).toBeVisible();
    await expect(leagueCard.locator('text=🏆')).toBeVisible();
  });
});