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

test.describe('Tricia Monitoring end-to-end flows', () => {
  test('admin user can sign in and access protected routes', async ({ page }) => {
    await signIn(page);

    await expect(page.getByRole('link', { name: 'Input' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Matrix' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Control' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();

    await page.getByRole('link', { name: 'Matrix' }).click();
    await expect(page).toHaveURL(/\/matrix(?:$|\?)/);

    await page.getByRole('link', { name: 'Control' }).click();
    await expect(page).toHaveURL(/\/control(?:$|\?)/);

    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page).toHaveURL(/\/users(?:$|\?)/);
  });

  test('matrix route renders filter controls and a populated table', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Matrix' }).click();

    await expect(page).toHaveURL(/\/matrix(?:$|\?)/);
    for (const title of ['Severity Matrix', 'Probability Matrix', 'Detectability Matrix', 'Risk Class Matrix']) {
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'All Time' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All' }).first()).toBeVisible();

    const caseTable = page.getByRole('table').filter({ hasText: /VK/i }).filter({ hasText: /WIMI/i }).first();
    await expect(caseTable).toBeVisible();
    await expect(caseTable.locator('tbody tr').first()).toBeVisible();
  });

  test('matrix filter selection updates the summary counts', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Matrix' }).click();

    const summaryButton = page.getByRole('button', { name: /Risk Class, Severity and Detectability Matrices - P:/i }).first();
    await expect(summaryButton).toContainText('P: 0 selected');

    const productMatrixCell = page.locator('[data-testid="risk-class-matrix-panel"] button:not([disabled])').first();
    await expect(productMatrixCell).toBeVisible();
    await productMatrixCell.click();

    await expect(summaryButton).not.toContainText('P: 0 selected');
    await expect(summaryButton).toContainText(/P: [1-9]\d* selected/i);
  });

  test('matrix export button is available and triggers a download', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Matrix' }).click();

    await page.getByRole('button', { name: 'All Time' }).click();
    await page.getByRole('button', { name: 'All' }).first().click();

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.getByRole('button', { name: /report html/i }).click(),
    ]);

    expect(download.suggestedFilename().length).toBeGreaterThan(0);
  });

  test('matrix filter controls cover the main period, risk, and table-settings combinations', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Matrix' }).click();

    await expect(page.getByRole('button', { name: 'All Time' })).toBeVisible();
    await page.getByRole('button', { name: '6 Months' }).click();
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
    await page.locator('input[type="date"]').first().fill(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    await page.locator('input[type="date"]').nth(1).fill(new Date().toISOString().slice(0, 10));

    await expect(page.getByText(/# Probl\. \(period\):/i)).toBeVisible();
    await expect(page.getByText(/# Probl\. \(filtered\):/i)).toBeVisible();
  });

  test('admin control dashboard and users management screens are accessible', async ({ page }) => {
    await signIn(page);

    await page.getByRole('link', { name: 'Control' }).click();
    await expect(page).toHaveURL(/\/control(?:$|\?)/);
    await expect(page.getByRole('heading', { name: 'Control Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: /CSV|XLSX/i }).first()).toBeVisible();

    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page).toHaveURL(/\/users(?:$|\?)/);
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add User' })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('users management can create a new user row', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Users' }).click();

    const username = `qa_e2e_${Date.now()}`;
    await page.locator('input[placeholder="Username"]').first().fill(username);
    await page.locator('input[placeholder="Display name"]').first().fill('QA E2E User');
    await page.locator('input[placeholder="Acronym (e.g. mam)"]').first().fill('qeu');
    await page.locator('input[placeholder="Password"]').first().fill('Str0ngPass!23');
    await page.getByRole('button', { name: 'Add User' }).click();

    await expect(page.getByText(username)).toBeVisible({ timeout: 30_000 });
  });

  test('control dashboard date controls keep the queue screen usable', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Control' }).click();

    await expect(page.getByRole('heading', { name: 'Control Dashboard' })).toBeVisible();
    await page.getByRole('button', { name: 'Input Date' }).click();
    await expect(page.getByRole('button', { name: 'Input Date' })).toHaveClass(/bg-stone-900/);

    await page.getByRole('button', { name: 'Custom' }).click();
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.locator('input[type="date"]').nth(1)).toBeVisible();
  });

  test('input page accepts a valid case and shows success feedback', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Input' }).click();

    await expect(page).toHaveURL(/\/input(?:$|\?)/);

    const uniqueCaseId = `Vk_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${String(Date.now() % 1000).padStart(3, '0')}`;

    await page.locator('input[aria-label="vk-number"]').fill(uniqueCaseId);
    await page.locator('input[aria-label="device-name"]').fill('E2E smoke device');
    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText(/saved|success|successfully/i)).toBeVisible({ timeout: 30_000 });
  });
});
