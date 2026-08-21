import { apiClient } from './api';

export const IMPORT_TEMPLATE_COLUMNS = [
    'vk_number',
    'device_name',
    'TRI-S',
    'TRI-P',
    'TRI-D',
    'WIMI-S',
    'WIMI-P',
    'WIMI-D',
];

const SHARED_EXPORT_COLUMN_NAMES: Record<string, string> = {
    vk_number: 'vk_number',
    device_name: 'device_name',
    tricia_s: 'TRI-S',
    tricia_p: 'TRI-P',
    tricia_d: 'TRI-D',
    user_s: 'WIMI-S',
    user_p: 'WIMI-P',
    user_d: 'WIMI-D',
    tri_risk: 'TRI-RISK',
    wimi_risk: 'WIMI-RISK',
};

export function getExportColumnName(column: string) {
    return SHARED_EXPORT_COLUMN_NAMES[column] ?? column;
}

export async function exportCasesCsv() {
    const { data } = await apiClient.get('/exports/cases.csv', { responseType: 'blob' });
    return data as Blob;
}

export async function exportCasesXlsx() {
    const { data } = await apiClient.get('/exports/cases.xlsx', { responseType: 'blob' });
    return data as Blob;
}

export async function exportVisibleTableCsv(columns: string[], rows: Array<Record<string, unknown>>, filters?: Record<string, unknown>) {
    const { data } = await apiClient.post(
        '/exports/table.csv',
        { columns, rows: filters ? [] : rows, filters },
        { responseType: 'blob' }
    );
    return data as Blob;
}

export async function exportVisibleTableXlsx(columns: string[], rows: Array<Record<string, unknown>>, filters?: Record<string, unknown>) {
    const payload = filters ? { columns, rows: [], filters } : { columns, rows };
    const { data } = await apiClient.post('/exports/table.xlsx', payload, { responseType: 'blob' });
    return data as Blob;
}

export async function exportImportTemplateXlsx() {
    return exportVisibleTableXlsx(IMPORT_TEMPLATE_COLUMNS, []);
}
