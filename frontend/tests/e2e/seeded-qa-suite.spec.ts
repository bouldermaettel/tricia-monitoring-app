import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const username = process.env.E2E_USERNAME ?? process.env.BOOTSTRAP_ADMIN_USERNAME ?? 'tricia.admin';
const password = process.env.E2E_PASSWORD ?? process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'swissmedic$01';
const fixtureText = readFileSync(new URL('./fixtures/qa-fixture.json', import.meta.url), 'utf8');
const qaFixture = JSON.parse(fixtureText) as {
  matrixPeriods: Array<{ label: string; risk: string }>;
  riskFilters: string[];
  pageSizes: number[];
  reportFormats: string[];
  adminUsers: Array<{ username: string; displayName: string; acronym: string; password: string }>;
  caseSeeds: Array<{ id: string; device: string }>;
};

async function signIn(page: any) {
  await page.goto('/');
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/input(?:$|\?)/);
}

test.describe('Tricia Monitoring seeded QA suite', () => {
  test('matrix filter matrix stays stable across the seeded period and risk combinations', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Matrix' }).click();

    for (const scenario of qaFixture.matrixPeriods) {
      await page.getByRole('button', { name: scenario.label }).click();
      if (scenario.risk !== 'All') {
        await page.getByRole('button', { name: scenario.risk }).click();
      }

      await expect(page.getByRole('button', { name: scenario.label })).toHaveClass(/bg-stone-900/);
      const caseTable = page.getByRole('table').filter({ hasText: /VK/i }).filter({ hasText: /WIMI/i }).first();
      await expect(caseTable).toBeVisible();
    }
  });

  test('risk filter buttons and page-size toggles remain consistent with the seeded QA scenarios', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Matrix' }).click();

    const riskButtons = page.locator('button').filter({ hasText: /^All$|^False Low$|^False High$/ });
    for (const risk of qaFixture.riskFilters) {
      const button = riskButtons.filter({ hasText: new RegExp(`^${risk.replace(/[-/\^$*+?.()|[\]{}]/g, '\\$&')}$`) });
      await button.first().click();
      await expect(button.first()).toHaveClass(/bg-stone-900/);
    }

    for (const pageSize of qaFixture.pageSizes) {
      const button = page.locator('button[type="button"]').filter({ hasText: new RegExp(`^${pageSize}$`) }).first();
      await button.click();
      await expect(button).toHaveClass(/bg-stone-900/);
    }

    await expect(page.getByRole('table').filter({ hasText: /VK/i }).first()).toBeVisible();
  });

  test('report exports work for each seeded report format', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Matrix' }).click();

    const htmlButton = page.getByRole('button', { name: 'Report HTML', exact: true });
    await expect(htmlButton).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      htmlButton.click(),
    ]);
    expect(download.suggestedFilename().length).toBeGreaterThan(0);

    const pdfButton = page.getByRole('button', { name: 'Report PDF', exact: true });
    await expect(pdfButton).toBeVisible();
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 30_000 }),
      pdfButton.click(),
    ]);
    await expect(popup).toBeTruthy();
  });

  test('admin user creation works for the seeded QA user set', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Users' }).click();

    for (const user of qaFixture.adminUsers) {
      const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
      const uniqueUsername = `${user.username}_${suffix}`;
      const uniqueAcronym = `${user.acronym}${suffix.slice(-2)}`;

      await page.locator('input[placeholder="Username"]').first().fill(uniqueUsername);
      await page.locator('input[placeholder="Display name"]').first().fill(`${user.displayName} ${suffix}`);
      await page.locator('input[placeholder="Acronym (e.g. mam)"]').first().fill(uniqueAcronym);
      await page.locator('input[placeholder="Password"]').first().fill(user.password);
      await page.getByRole('button', { name: 'Add User' }).click();
      await expect(page.getByText(uniqueUsername)).toBeVisible({ timeout: 30_000 });
    }
  });

  test('input dashboard accepts all seeded case identifiers and stores them without validation errors', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Input' }).click();

    for (const seed of qaFixture.caseSeeds) {
      const uniqueId = `${seed.id.slice(0, -3)}${String(Date.now() % 1000).padStart(3, '0')}`;
      await page.locator('input[aria-label="vk-number"]').fill(uniqueId);
      await page.locator('input[aria-label="device-name"]').fill(`${seed.device} ${Date.now()}`);
      await page.getByRole('button', { name: /save/i }).click();
      await expect(page.getByText(/saved|success|successfully/i)).toBeVisible({ timeout: 30_000 });
    }
  });
});
