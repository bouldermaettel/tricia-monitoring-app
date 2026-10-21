import { expect, test } from '@playwright/test';

const username = process.env.E2E_USERNAME ?? process.env.BOOTSTRAP_ADMIN_USERNAME ?? 'tricia.admin';
const password = process.env.E2E_PASSWORD ?? process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'swissmedic$01';

async function signIn(page: any) {
  await page.goto('/');
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/input(?:$|\?)/);
}

test.describe('Tricia Monitoring matrix filter coverage', () => {
  const matrixScenarios = [
    { label: '3 Months', risk: 'All' },
    { label: '6 Months', risk: 'False Low' },
    { label: '12 Months', risk: 'False High' },
    { label: 'All Time', risk: 'All' },
  ];

  for (const scenario of matrixScenarios) {
    test(`matrix dashboard stays usable with ${scenario.label} period and ${scenario.risk} risk filter`, async ({ page }) => {
      await signIn(page);
      await page.getByRole('link', { name: 'Matrix' }).click();

      await page.getByRole('button', { name: scenario.label }).click();
      if (scenario.risk !== 'All') {
        await page.getByRole('button', { name: scenario.risk }).click();
      }

      await expect(page.getByRole('button', { name: scenario.label })).toHaveClass(/bg-stone-900/);
      await expect(page).toHaveURL(/\/matrix(?:$|\?)/);

      const caseTable = page.getByRole('table').filter({ hasText: /VK/i }).filter({ hasText: /WIMI/i }).first();
      await expect(caseTable).toBeVisible();
      await expect(caseTable.locator('tbody tr').first()).toBeVisible();
    });
  }

  test('matrix supports problematic-only, page-size, and custom-date filters without breaking the table', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Matrix' }).click();

    await page.getByRole('button', { name: 'All Time' }).click();
    await page.getByRole('button', { name: 'False Low' }).click();

    const problematicToggle = page.getByLabel('Problematic only');
    await problematicToggle.check();
    await expect(problematicToggle).toBeChecked();

    await page.getByRole('button', { name: '50' }).click();
    await expect(page.getByRole('button', { name: '50' })).toHaveClass(/bg-stone-900/);

    await page.getByRole('button', { name: 'Custom' }).click();
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs.first()).toBeVisible();
    await expect(dateInputs.nth(1)).toBeVisible();

    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    await dateInputs.first().fill(from);
    await dateInputs.nth(1).fill(to);

    await expect(page.getByText(/# Probl\. \(period\):/i)).toBeVisible();
    await expect(page.getByText(/# Probl\. \(filtered\):/i)).toBeVisible();

    const caseTable = page.getByRole('table').filter({ hasText: /VK/i }).filter({ hasText: /WIMI/i }).first();
    await expect(caseTable).toBeVisible();
  });

  test('matrix matrix summary remains stable after selecting several cells in different dimensions', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Matrix' }).click();

    const summary = page.getByRole('button', { name: /Risk Class, Severity and Detectability Matrices - P:/i }).first();
    await expect(summary).toContainText('P: 0 selected');

    const productCell = page.locator('[data-testid="risk-class-matrix-panel"] button:not([disabled])').first();
    await expect(productCell).toBeVisible();
    await productCell.click();

    const severityCell = page.locator('button:not([disabled]):not([aria-disabled="true"])').filter({ hasText: /^\d+$/ }).nth(1);
    await expect(severityCell).toBeVisible();
    await severityCell.click();

    await expect(summary).not.toContainText('P: 0 selected');
    await expect(summary).toContainText(/P: [1-9]\d* selected/i);
  });
});
