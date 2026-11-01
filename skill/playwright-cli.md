# Skill: Playwright CLI

## What it is
Playwright is an end-to-end testing framework for web applications. The CLI (`npx playwright`) lets you run browser tests that simulate real user interactions.

## Status
**Installed** in `web/` as a devDependency (`@playwright/test` v1.64.1).

## Installation check
```powershell
cd web
npx playwright --version
```

## Basic workflow

### Initialize Playwright (if not already done)
```powershell
npx playwright init
```

### Generate tests from recording
```powershell
npx playwright codegen http://localhost:3000
```

### Run tests
```powershell
npx playwright test
```

### Run tests in headed mode (see the browser)
```powershell
npx playwright test --headed
```

### Debug a test
```powershell
npx playwright test --debug
```

## ASTRA E2E test scenarios to cover
1. **Login flow**: navigate to `/login`, click a demo role button, land on `/dashboard`
2. **Report flow**: navigate to `/report`, fill form, submit, land on `/incidents/{id}`
3. **List page**: navigate to `/incidents`, verify incidents load, filters work, pagination works
4. **Detail page**: click an incident, verify 4-axis cards, poll card, evidence list
5. **WS live update**: submit report in one tab, verify it prepends in list on another tab
6. **Verification flow** (officer role): navigate to `/verification`, click Investigate, mark VERIFIED, verify pin/map/list flips
7. **Accessibility**: keyboard navigation works, focus states visible

## Test file location
`web/tests/` or `web/e2e/` — follow Playwright convention: `*.spec.ts`

## Example test skeleton
```typescript
import { test, expect } from '@playwright/test';

test('citizen can submit a report', async ({ page }) => {
  await test.step('login as citizen', async () => {
    await page.goto('/login');
    await page.click('text=Citizen');
    await expect(page).toHaveURL('/dashboard');
  });

  await test.step('submit a report', async () => {
    await page.click('text=+ Report Incident');
    await page.fill('input[name="title"]', 'Test fire report');
    await page.fill('textarea[name="description"]', 'Smoke visible from two blocks away.');
    await page.click('text=Fire');
    await page.click('button:has-text("Submit report")');
    await expect(page).toHaveURL(/\/incidents\//);
  });

  await test.step('report appears in list', async () => {
    await page.goto('/incidents');
    await expect(page.getByText('Test fire report')).toBeVisible();
  });
});
```
