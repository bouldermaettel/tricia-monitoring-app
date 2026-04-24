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
export async function updateCase(caseId, payload) {
    const { data } = await apiClient.put(`/cases/${caseId}`, payload);
    return data;
}
export async function deleteCase(caseId) {
    const { data } = await apiClient.delete(`/cases/${caseId}`);
    return data;
}
export async function bulkDeleteCases(caseIds) {
    const { data } = await apiClient.delete('/cases', { data: { case_ids: caseIds } });
    return data;
}
export async function getCaseAuditTrail(caseId, limit = 100) {
    const { data } = await apiClient.get(`/cases/${caseId}/audit-trail`, { params: { limit } });
    return data;
}
