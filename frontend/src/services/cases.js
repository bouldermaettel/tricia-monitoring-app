import { apiClient } from './api';
export async function validateCase(payload) {
    const { data } = await apiClient.post('/cases/validate', payload);
    return data;
}
export async function createCase(payload) {
    const { data } = await apiClient.post('/cases', { ...payload, validation_status: payload.validation_status ?? 'saved' });
    return data;
}
export async function listCases(params) {
    const { data } = await apiClient.get('/cases', { params });
    return data;
}
export async function patchCaseReview(caseId, payload) {
    const { data } = await apiClient.patch(`/cases/${caseId}/review`, payload);
    return data;
}
export async function addCaseComment(caseId, text) {
    const { data } = await apiClient.post(`/cases/${caseId}/comments`, { text });
    return data;
}
