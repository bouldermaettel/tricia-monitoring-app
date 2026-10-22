import { apiClient } from './api';

const IMPORT_TEMPLATE_COLUMNS = [
    'vk_number',
    'device_name',
    'TRI-S',
    'TRI-P',
    'TRI-D',
    'WIMI-S',
    'WIMI-P',
    'WIMI-D',
];

const EXPORT_COLUMN_NAMES: Record<string, string> = {
    tricia_s: 'TRI-S', tricia_p: 'TRI-P', tricia_d: 'TRI-D',
    user_s: 'WIMI-S', user_p: 'WIMI-P', user_d: 'WIMI-D',
    tri_risk: 'TRI-RISK', wimi_risk: 'WIMI-RISK',
};

export function getExportColumnName(column: string) {
    return EXPORT_COLUMN_NAMES[column] ?? column;
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
        filters ? { columns, filters } : { columns, rows },
        { responseType: 'blob' }
    );
    return data as Blob;
}

export async function exportVisibleTableXlsx(columns: string[], rows: Array<Record<string, unknown>>, filters?: Record<string, unknown>) {
    const { data } = await apiClient.post(
        '/exports/table.xlsx',
        filters ? { columns, filters } : { columns, rows },
        { responseType: 'blob' }
    );
    return data as Blob;
}

export async function exportImportTemplateXlsx() {
    return exportVisibleTableXlsx(IMPORT_TEMPLATE_COLUMNS, []);
}
