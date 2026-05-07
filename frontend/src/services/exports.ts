import { apiClient } from './api';

const IMPORT_TEMPLATE_COLUMNS = [
    'vk_number',
    'device_name',
    'analysis_date',
    'input_timestamp',
    'wimi_shortcut',
    'validation_status',
    'TRI-S',
    'TRI-P',
    'TRI-D',
    'WIMI-S',
    'WIMI-D',
    'category_code',
    'risk_level',
    'is_excluded',
    'is_reviewed',
];

export async function exportCasesCsv() {
    const { data } = await apiClient.get('/exports/cases.csv', { responseType: 'blob' });
    return data as Blob;
}

export async function exportCasesXlsx() {
    const { data } = await apiClient.get('/exports/cases.xlsx', { responseType: 'blob' });
    return data as Blob;
}

export async function exportVisibleTableCsv(columns: string[], rows: Array<Record<string, unknown>>) {
    const { data } = await apiClient.post(
        '/exports/table.csv',
        { columns, rows },
        { responseType: 'blob' }
    );
    return data as Blob;
}

export async function exportVisibleTableXlsx(columns: string[], rows: Array<Record<string, unknown>>) {
    const { data } = await apiClient.post(
        '/exports/table.xlsx',
        { columns, rows },
        { responseType: 'blob' }
    );
    return data as Blob;
}

export async function exportImportTemplateXlsx() {
    return exportVisibleTableXlsx(IMPORT_TEMPLATE_COLUMNS, []);
}
