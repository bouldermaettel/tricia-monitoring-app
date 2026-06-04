import { apiClient } from './api';

export type ImportDuplicateAction = 'error' | 'replace' | 'skip';

export async function uploadImport(file: File, duplicateAction: ImportDuplicateAction = 'error') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('duplicate_action', duplicateAction);
    const { data } = await apiClient.post('/imports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
}

export async function previewImport(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post('/imports/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
}
