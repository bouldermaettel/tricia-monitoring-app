import { apiClient } from './api';
export async function exportCasesCsv() {
    const { data } = await apiClient.get('/exports/cases.csv', { responseType: 'blob' });
    return data;
}
export async function exportCasesXlsx() {
    const { data } = await apiClient.get('/exports/cases.xlsx', { responseType: 'blob' });
    return data;
}
export async function exportVisibleTableCsv(columns, rows) {
    const { data } = await apiClient.post('/exports/table.csv', { columns, rows }, { responseType: 'blob' });
    return data;
}
export async function exportVisibleTableXlsx(columns, rows) {
    const { data } = await apiClient.post('/exports/table.xlsx', { columns, rows }, { responseType: 'blob' });
    return data;
}
