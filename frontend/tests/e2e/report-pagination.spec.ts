import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const today = new Date().toISOString().slice(0, 10);
const cases = Array.from({ length: 120 }, (_, i) => ({
  id: `report-${i}`, vk_number: `Vk_${today.replace(/-/g, '')}_${String(i).padStart(3, '0')}`,
  device_name: i < 90 ? 'Matching device' : 'Other device', wimi_shortcut: 'qa',
  analysis_date: today, date_reported: today, validation_status: 'saved',
  tricia_s: i < 60 ? 5 : 3, user_s: i < 60 ? 5 : 3,
  tricia_p: 1, user_p: i < 60 ? 1 : 5, tricia_d: 1, user_d: 1,
  tri_risk: i < 60 ? 5 : 3, wimi_risk: i < 60 ? 5 : 15,
  is_excluded: false, is_reviewed: false, has_edits: false, comment_text: '',
}));

function matchingCases(params: URLSearchParams) {
  return cases.filter(item => {
    if (params.get('problematic_only') === 'true') return false;
    if (params.get('device_name') && !item.device_name.toLowerCase().includes(params.get('device_name')!.toLowerCase())) return false;
    const dims = {
      probability: [item.user_p, item.tricia_p], severity: [item.user_s, item.tricia_s],
      detectability: [item.user_d, item.tricia_d], product: [item.wimi_risk, item.tri_risk],
    };
    for (const [dim, pair] of Object.entries(dims)) {
      const selected = params.get(`${dim}_cells`);
      if (selected && !selected.split(',').includes(pair.join(':'))) return false;
      if (params.get('matrix_dimension') === dim &&
          (Number(params.get('expected_value')) !== pair[0] || Number(params.get('observed_value')) !== pair[1])) return false;
    }
    return true;
  });
}

const allRequests: Array<Record<string, string>> = [];
test.beforeEach(async ({ page }) => {
  allRequests.length = 0;
  await page.addInitScript(() => {
    sessionStorage.setItem('monitoring.session', JSON.stringify({
      token: 'qa-token', refreshToken: 'qa-refresh', tokenType: 'bearer',
      expiresAt: Date.now() + 3600000, refreshExpiresAt: Date.now() + 3600000,
      actorId: 'qa', externalKey: 'qa', displayName: 'QA', role: 'admin', mustChangePassword: false,
    }));
  });
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/config/thresholds')) {
      await route.fulfill({ json: { acceptance_threshold: 1, risk_categories: [
        { label: 'Low', min_value: 0, max_value: 10 }, { label: 'High', min_value: 11, max_value: 1000 },
      ] } });
    } else if (url.pathname.endsWith('/cases')) {
      const params = url.searchParams;
      let rows = matchingCases(params);
      if (params.get('sort_by') === 'vk_number') rows = [...rows].sort((a, b) => a.vk_number.localeCompare(b.vk_number) * (params.get('sort_dir') === 'desc' ? -1 : 1));
      const total = rows.length;
      const all = params.get('all') === 'true';
      if (all) allRequests.push(Object.fromEntries(params));
      const pageNumber = Number(params.get('page') ?? 1);
      const size = Number(params.get('page_size') ?? 50);
      await route.fulfill({ json: { total, page: pageNumber, page_size: all ? total : size, items: all ? rows : rows.slice((pageNumber - 1) * size, pageNumber * size) } });
    } else if (url.pathname.endsWith('/matrices/confusion')) {
      const rows = matchingCases(url.searchParams);
      const cells = (expected: keyof typeof cases[number], observed: keyof typeof cases[number]) => {
        const grouped = new Map<string, { expected_value: number; observed_value: number; case_count: number; within_threshold: boolean }>();
        for (const row of rows) {
          const key = `${row[expected]}:${row[observed]}`;
          const cell = grouped.get(key) ?? { expected_value: Number(row[expected]), observed_value: Number(row[observed]), case_count: 0, within_threshold: true };
          cell.case_count++;
          grouped.set(key, cell);
        }
        return [...grouped.values()];
      };
      const matrices = { severity: cells('user_s', 'tricia_s'), probability: cells('user_p', 'tricia_p'), detectability: cells('user_d', 'tricia_d'), product: cells('wimi_risk', 'tri_risk') };
      await route.fulfill({ json: { cells: matrices.detectability, matrices } });
    } else {
      await route.fulfill({ status: 404, json: { detail: `Unexpected QA request: ${url.pathname}` } });
    }
  });
  await page.goto('/matrix');
  await expect(page.getByRole('heading', { name: 'Probability Matrix', exact: true })).toBeVisible();
});

async function filterDevice(page: Page) {
  const table = page.getByRole('table').filter({ hasText: 'VK' }).filter({ hasText: 'WIMI' }).first();
  const headers = table.locator('thead tr').first().locator('th');
  const labels = await headers.allTextContents();
  const index = labels.findIndex(text => text.trim().startsWith('Device'));
  await table.locator('thead tr').nth(1).locator('th').nth(index).getByPlaceholder('Filter...').fill('Matching');
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  await expect(page.getByText(/\(90 total\)/)).toBeVisible();
}

async function htmlReport(page: Page) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Report HTML', exact: true }).click();
  const download = await downloadPromise;
  return readFile((await download.path())!, 'utf8');
}
async function reportIds(page: Page, html: string) {
  return page.evaluate(text => {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return [...([...doc.querySelectorAll('table')].at(-1)!.querySelectorAll('tbody tr'))].map(row => row.querySelector('td')!.textContent);
  }, html);
}

test('HTML includes all filtered pages regardless of page or page size', async ({ page }) => {
  await filterDevice(page);
  const expected = cases.slice(0, 90).map(item => item.vk_number);
  const first = await htmlReport(page);
  expect(await reportIds(page, first)).toEqual(expected);
  for (const title of ['Severity Matrix', 'Probability Matrix', 'Detectability Matrix', 'Risk Class Matrix']) expect(first).toContain(title);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  expect(await reportIds(page, await htmlReport(page))).toEqual(expected);
  await page.getByRole('button', { name: '25', exact: true }).click();
  expect(await reportIds(page, await htmlReport(page))).toEqual(expected);
  expect(allRequests.at(-1)).toMatchObject({ all: 'true', device_name: 'Matching' });
  expect(allRequests.at(-1)).not.toHaveProperty('page');
  expect(allRequests.at(-1)).not.toHaveProperty('page_size');
  const caseTable = page.getByRole('table').filter({ hasText: 'VK' }).filter({ hasText: 'WIMI' }).first();
  const sort = caseTable.getByRole('button', { name: /^VK / });
  await sort.click();
  await sort.click();
  expect(await reportIds(page, await htmlReport(page))).toEqual([...expected].reverse());
  expect(allRequests.at(-1)).toMatchObject({ sort_by: 'vk_number', sort_dir: 'desc' });
});

async function matrixCell(page: Page, title: string, expected: number, observed: number) {
  const panel = page.getByRole('heading', { name: title, exact: true }).locator('..');
  const headings = await panel.locator('thead th').allTextContents();
  const column = headings.slice(1).findIndex(text => text.trim() === String(observed));
  const row = panel.locator('tbody tr').filter({ has: page.getByRole('rowheader', { name: String(expected), exact: true }) });
  return row.locator('td').nth(column).getByRole('button');
}

test('PDF print document includes the complete probability and severity intersection', async ({ page }) => {
  await filterDevice(page);
  await (await matrixCell(page, 'Probability Matrix', 1, 1)).click();
  await (await matrixCell(page, 'Severity Matrix', 5, 5)).click();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Report PDF', exact: true }).click();
  const popup = await popupPromise;
  await expect(popup.locator('table').last().locator('tbody tr')).toHaveCount(60);
  const ids = await popup.locator('table').last().locator('tbody tr td:first-child').allTextContents();
  expect(ids).toEqual(cases.slice(0, 60).map(item => item.vk_number));
  expect(allRequests.at(-1)).toMatchObject({ all: 'true', probability_cells: '1:1', severity_cells: '5:5', device_name: 'Matching' });
});

test('multiple probability cells form a union and still intersect severity selection', async ({ page }) => {
  await filterDevice(page);
  await (await matrixCell(page, 'Probability Matrix', 1, 1)).click();
  await (await matrixCell(page, 'Probability Matrix', 5, 1)).click();
  expect(await reportIds(page, await htmlReport(page))).toEqual(cases.slice(0, 90).map(item => item.vk_number));
  await (await matrixCell(page, 'Severity Matrix', 5, 5)).click();
  expect(await reportIds(page, await htmlReport(page))).toEqual(cases.slice(0, 60).map(item => item.vk_number));
  expect(allRequests.at(-1)).toMatchObject({ probability_cells: '1:1,5:1', severity_cells: '5:5' });
});
