# Playwright Tests for Betting with Friends

This directory contains end-to-end tests for the betting application using Playwright.

## Test Structure

### Test Files

- **`auth.spec.ts`** - Authentication flow tests
  - Sign in page display and validation
  - Email submission and success/error states
  - Loading states during authentication

- **`navigation.spec.ts`** - UI and navigation tests  
  - Responsive design validation
  - Button styling and hover effects
  - Accessibility checks for form elements

- **`leagues.spec.ts`** - League management tests
  - Leagues page display (authenticated)
  - Empty states when no leagues exist
  - Navigation to create/join league pages
  - League card interactions and styling

- **`visual.spec.ts`** - Visual design and styling tests
  - Gradient backgrounds and glass morphism
  - Typography hierarchy and spacing
  - Mobile responsiveness
  - Focus states and accessibility
  - Loading animations and color consistency

## Running Tests

Make sure your development server is running (`npm run dev`), then:

```bash
# Run all tests headlessly
npm run test

# Run tests with browser visible
npm run test:headed

# Run tests with interactive UI
npm run test:ui

# View test report
npm run test:report
```

## Test Configuration

Tests are configured in `playwright.config.ts` with:
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile device testing (Pixel 5, iPhone 12)
- Automatic dev server startup
- Trace collection on failures

## Mocking

Tests use route mocking to simulate:
- Supabase authentication responses
- API calls for leagues data
- Loading states and error conditions

## Key Test Features

✅ **Authentication Flow**
- Email validation and submission
- Success/error message display
- Loading states

✅ **Visual Design**
- Gradient backgrounds
- Glass morphism effects  
- Responsive design
- Typography and spacing

✅ **League Management**
- Empty states
- League card interactions
- Navigation flows

✅ **Accessibility**
- Form label associations
- Focus management
- Touch target sizes

## Adding New Tests

When adding new features, create corresponding test files:
1. Follow the naming pattern `feature.spec.ts`
2. Use the existing mocking patterns for API calls
3. Test both happy path and error scenarios
4. Include mobile responsiveness checks