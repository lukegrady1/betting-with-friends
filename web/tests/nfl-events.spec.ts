import { test, expect } from '@playwright/test';

test.describe('NFL Events Integration', () => {
  // Mock authenticated admin user for events tests
  test.beforeEach(async ({ page }) => {
    // Mock Supabase session
    await page.addInitScript(() => {
      // Mock localStorage to simulate authenticated user
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: 'mock-admin-id', email: 'admin@example.com' }
      }));
    });

    // Mock Supabase auth response
    await page.route('**/auth/v1/user', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'mock-admin-id', email: 'admin@example.com' }
        })
      });
    });

    // Mock league membership with admin role
    await page.route('**/rest/v1/league_members*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            league_id: 'league-123',
            user_id: 'mock-admin-id',
            role: 'admin'
          }
        ])
      });
    });

    // Mock user league role query
    await page.route('**/rest/v1/league_members?select=role*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          role: 'admin'
        })
      });
    });
  });

  test('should display events page with NFL integration', async ({ page }) => {
    // Mock events API response with NFL games
    await page.route('**/rest/v1/events*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'event-1',
            league_id: 'league-123',
            sport: 'NFL',
            league_name: 'NFL',
            season: 2024,
            week: 1,
            home_team: 'NE',
            away_team: 'BUF',
            start_time: '2024-09-08T17:00:00Z',
            status: 'scheduled',
            venue_name: 'Gillette Stadium',
            venue_city: 'Foxborough',
            venue_state: 'MA',
            picks: [],
            pick_count: 0,
            user_has_pick: false
          },
          {
            id: 'event-2',
            league_id: 'league-123',
            sport: 'NFL',
            league_name: 'NFL',
            season: 2024,
            week: 1,
            home_team: 'KC',
            away_team: 'BAL',
            start_time: '2024-09-05T20:20:00Z',
            status: 'final',
            home_score: 27,
            away_score: 20,
            venue_name: 'GEHA Field at Arrowhead Stadium',
            venue_city: 'Kansas City',
            venue_state: 'MO',
            picks: [],
            pick_count: 3,
            user_has_pick: true
          }
        ])
      });
    });

    await page.goto('/leagues/league-123/events');

    // Should display events page
    await expect(page).toHaveURL(/\/leagues\/league-123\/events/);
    
    // Check for page title
    await expect(page.locator('h1')).toContainText('Events');
    
    // Check for NFL season/week header
    await expect(page.locator('text=Week 1, 2024 NFL Season')).toBeVisible();
    
    // Check for sync button (admin only)
    await expect(page.locator('button:has-text("Sync NFL Week")')).toBeVisible();

    // Check for event cards
    await expect(page.locator('text=Bills @ Patriots')).toBeVisible();
    await expect(page.locator('text=Ravens @ Chiefs')).toBeVisible();

    // Check venue information
    await expect(page.locator('text=Gillette Stadium')).toBeVisible();
    await expect(page.locator('text=Foxborough, MA')).toBeVisible();

    // Check event status badges
    await expect(page.locator('text=Scheduled')).toBeVisible();
    await expect(page.locator('text=Final')).toBeVisible();

    // Check pick counts
    await expect(page.locator('text=0 picks made')).toBeVisible();
    await expect(page.locator('text=3 picks made')).toBeVisible();
  });

  test('should sync NFL events when clicking sync button', async ({ page }) => {
    // Mock initial empty events
    await page.route('**/rest/v1/events*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Mock sync function response
    await page.route('**/functions/v1/nfl-sync-week*', async route => {
      // Simulate successful sync
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: 16,
          message: 'Synced 16 events for week 1 of 2024 season'
        })
      });
    });

    await page.goto('/leagues/league-123/events');

    // Click sync button
    await page.click('button:has-text("Sync NFL Week")');

    // Should show loading state
    await expect(page.locator('button:has-text("Syncing")')).toBeVisible();
    
    // Should show spinner icon
    await expect(page.locator('.animate-spin')).toBeVisible();
  });

  test('should handle sync errors gracefully', async ({ page }) => {
    await page.route('**/rest/v1/events*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Mock sync function error
    await page.route('**/functions/v1/nfl-sync-week*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'API key invalid',
          message: 'Failed to sync NFL events. Please check API key and try again.'
        })
      });
    });

    await page.goto('/leagues/league-123/events');

    // Click sync button
    await page.click('button:has-text("Sync NFL Week")');

    // Should eventually show error message
    await expect(page.locator('text=API key invalid')).toBeVisible({ timeout: 10000 });
  });

  test('should filter events by status', async ({ page }) => {
    await page.route('**/rest/v1/events*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'event-1',
            league_id: 'league-123',
            sport: 'NFL',
            home_team: 'NE',
            away_team: 'BUF',
            start_time: '2024-09-08T17:00:00Z',
            status: 'scheduled',
            picks: [],
            pick_count: 0,
            user_has_pick: false
          },
          {
            id: 'event-2',
            league_id: 'league-123',
            sport: 'NFL',
            home_team: 'KC',
            away_team: 'BAL',
            start_time: '2024-09-05T20:20:00Z',
            status: 'final',
            home_score: 27,
            away_score: 20,
            picks: [],
            pick_count: 3,
            user_has_pick: true
          }
        ])
      });
    });

    await page.goto('/leagues/league-123/events');

    // All events should be visible initially
    await expect(page.locator('text=Bills @ Patriots')).toBeVisible();
    await expect(page.locator('text=Ravens @ Chiefs')).toBeVisible();

    // Click upcoming filter
    await page.click('button:has-text("upcoming")');
    
    // Only scheduled events should be visible
    await expect(page.locator('text=Bills @ Patriots')).toBeVisible();

    // Click completed filter
    await page.click('button:has-text("completed")');
    
    // Only final events should be visible
    await expect(page.locator('text=Ravens @ Chiefs')).toBeVisible();

    // Click all filter
    await page.click('button:has-text("all")');
    
    // All events should be visible again
    await expect(page.locator('text=Bills @ Patriots')).toBeVisible();
    await expect(page.locator('text=Ravens @ Chiefs')).toBeVisible();
  });

  test('should navigate to new pick page for available events', async ({ page }) => {
    // Mock scheduled event that allows picks
    await page.route('**/rest/v1/events*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'event-1',
            league_id: 'league-123',
            sport: 'NFL',
            home_team: 'NE',
            away_team: 'BUF',
            start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
            status: 'scheduled',
            venue_name: 'Gillette Stadium',
            venue_city: 'Foxborough',
            venue_state: 'MA',
            picks: [],
            pick_count: 0,
            user_has_pick: false
          }
        ])
      });
    });

    await page.goto('/leagues/league-123/events');

    // Should show "Make Pick" button for upcoming events without user picks
    await expect(page.locator('button:has-text("Make Pick")')).toBeVisible();
    
    // Should show "Available for picks" indicator
    await expect(page.locator('text=Available for picks')).toBeVisible();

    // Click Make Pick button
    await page.click('button:has-text("Make Pick")');

    // Should navigate to new pick page with event query parameter
    await expect(page).toHaveURL(/\/leagues\/league-123\/picks\/new\?event=event-1/);
  });

  test('should display pick form with event details', async ({ page }) => {
    // Mock event for pick form
    await page.route('**/rest/v1/events*event=event-1*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'event-1',
          league_id: 'league-123',
          sport: 'NFL',
          home_team: 'NE',
          away_team: 'BUF',
          start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          status: 'scheduled',
          venue_name: 'Gillette Stadium',
          venue_city: 'Foxborough',
          venue_state: 'MA'
        })
      });
    });

    await page.goto('/leagues/league-123/picks/new?event=event-1');

    // Should display page title
    await expect(page.locator('text=New Pick')).toBeVisible();

    // Should display event details
    await expect(page.locator('text=Bills @ Patriots')).toBeVisible();
    await expect(page.locator('text=Gillette Stadium')).toBeVisible();
    await expect(page.locator('text=Foxborough, MA')).toBeVisible();

    // Should display pick form
    await expect(page.locator('text=Make Your Pick')).toBeVisible();
    await expect(page.locator('text=Bet Type')).toBeVisible();

    // Should display market options
    await expect(page.locator('button:has-text("moneyline")')).toBeVisible();
    await expect(page.locator('button:has-text("spread")')).toBeVisible();
    await expect(page.locator('button:has-text("total")')).toBeVisible();

    // Should display side options for moneyline (default)
    await expect(page.locator('button:has-text("Bills")')).toBeVisible();
    await expect(page.locator('button:has-text("Patriots")')).toBeVisible();

    // Should display odds and units inputs
    await expect(page.locator('input[placeholder*="e.g., -110 or +150"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="e.g., 1.0"]')).toBeVisible();

    // Should display submit button
    await expect(page.locator('button:has-text("Place Pick")')).toBeVisible();
  });

  test('should handle spread and total market selections', async ({ page }) => {
    await page.route('**/rest/v1/events*event=event-1*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'event-1',
          sport: 'NFL',
          home_team: 'NE',
          away_team: 'BUF',
          start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: 'scheduled'
        })
      });
    });

    await page.goto('/leagues/league-123/picks/new?event=event-1');

    // Click spread market
    await page.click('button:has-text("spread")');

    // Should show line input for spread
    await expect(page.locator('text=Line (Spread)')).toBeVisible();
    await expect(page.locator('input[placeholder*="e.g., -3.5"]')).toBeVisible();

    // Click total market
    await page.click('button:has-text("total")');

    // Should show over/under options
    await expect(page.locator('button:has-text("Over")')).toBeVisible();
    await expect(page.locator('button:has-text("Under")')).toBeVisible();

    // Should show line input for total
    await expect(page.locator('text=Line (Total Points)')).toBeVisible();
    await expect(page.locator('input[placeholder*="e.g., 44.5"]')).toBeVisible();
  });

  test('should validate pick form and show errors', async ({ page }) => {
    await page.route('**/rest/v1/events*event=event-1*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'event-1',
          sport: 'NFL',
          home_team: 'NE',
          away_team: 'BUF',
          start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: 'scheduled'
        })
      });
    });

    await page.goto('/leagues/league-123/picks/new?event=event-1');

    // Clear the default values to trigger validation
    await page.fill('input[placeholder*="e.g., -110 or +150"]', '');
    await page.fill('input[placeholder*="e.g., 1.0"]', '');

    // Try to submit form
    await page.click('button:has-text("Place Pick")');

    // Should show validation errors
    await expect(page.locator('text=Odds are required')).toBeVisible();
    await expect(page.locator('text=Units must be greater than 0')).toBeVisible();

    // Select spread market and try to submit without line
    await page.click('button:has-text("spread")');
    await page.click('button:has-text("Place Pick")');

    // Should show line validation error
    await expect(page.locator('text=Line is required for spread and total bets')).toBeVisible();
  });

  test('should prevent picks on started events', async ({ page }) => {
    // Mock event that has already started
    await page.route('**/rest/v1/events*event=event-1*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'event-1',
          sport: 'NFL',
          home_team: 'NE',
          away_team: 'BUF',
          start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
          status: 'scheduled'
        })
      });
    });

    await page.goto('/leagues/league-123/picks/new?event=event-1');

    // Should show "Event Has Started" message
    await expect(page.locator('text=Event Has Started')).toBeVisible();
    await expect(page.locator('text=You can no longer place picks on this event.')).toBeVisible();

    // Should show back button
    await expect(page.locator('button:has-text("Back to Events")')).toBeVisible();
  });

  test('should display quick stats cards', async ({ page }) => {
    await page.route('**/rest/v1/events*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'event-1',
            status: 'scheduled',
            start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            picks: [],
            pick_count: 2
          },
          {
            id: 'event-2',
            status: 'scheduled', 
            start_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            picks: [],
            pick_count: 3
          },
          {
            id: 'event-3',
            status: 'final',
            start_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            picks: [],
            pick_count: 1
          }
        ])
      });
    });

    await page.goto('/leagues/league-123/events');

    // Should show quick stats cards
    await expect(page.locator('text=2').first()).toBeVisible(); // Upcoming count
    await expect(page.locator('text=Upcoming').first()).toBeVisible();
    
    await expect(page.locator('text=1').nth(1)).toBeVisible(); // Completed count  
    await expect(page.locator('text=Completed').first()).toBeVisible();
    
    await expect(page.locator('text=6').first()).toBeVisible(); // Total picks (2+3+1)
    await expect(page.locator('text=Total Picks').first()).toBeVisible();
  });
});