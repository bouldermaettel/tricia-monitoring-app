import { apiClient } from './api';

export type CasePayload = {
    vk_number: string;
    device_name: string;
    tricia_s: number;
    tricia_p: number;
    tricia_d: number;
    user_s: number;
    user_d?: number;
    validation_status?: string;
};

export type CaseUpdatePayload = {
    device_name?: string;
    analysis_date?: string;
    validation_status?: string;
    tricia_s?: number;
    tricia_p?: number;
    tricia_d?: number;
    user_s?: number;
    user_d?: number;
};

export type CaseAuditChange = {
    from: string | number | boolean | null;
    to: string | number | boolean | null;
};

export type CaseAuditEvent = {
    id: number;
    case_id: string;
    action: string;
    actor_id?: string | null;
    actor_display_name?: string | null;
    changes: Record<string, CaseAuditChange>;
    created_at: string;
};

export type CaseAuditTrailResponse = {
    items: CaseAuditEvent[];
};

export async function validateCase(payload: CasePayload) {
    const { data } = await apiClient.post('/cases/validate', payload);
    return data;
}

export async function createCase(payload: CasePayload) {
    const { data } = await apiClient.post('/cases', { ...payload, validation_status: payload.validation_status ?? 'saved' });
    return data;
}

export async function listCases(params?: Record<string, unknown>) {
    const { data } = await apiClient.get('/cases', { params });
    return data;
}

export async function patchCaseReview(caseId: string, payload: Record<string, unknown>) {
    const { data } = await apiClient.patch(`/cases/${caseId}/review`, payload);
    return data;
}

export async function addCaseComment(caseId: string, text: string) {
    const { data } = await apiClient.post(`/cases/${caseId}/comments`, { text });
    return data;
}

export async function updateCase(caseId: string, payload: CaseUpdatePayload) {
    const { data } = await apiClient.put(`/cases/${caseId}`, payload);
    return data;
}

export async function deleteCase(caseId: string) {
    const { data } = await apiClient.delete(`/cases/${caseId}`);
    return data;
}

export async function bulkDeleteCases(caseIds: string[]) {
    const { data } = await apiClient.delete('/cases', { data: { case_ids: caseIds } });
    return data;
}

export async function getCaseAuditTrail(caseId: string, limit = 100): Promise<CaseAuditTrailResponse> {
    const { data } = await apiClient.get(`/cases/${caseId}/audit-trail`, { params: { limit } });
    return data;
}

export async function downloadCaseAuditTrailXlsx(caseId: string, vkNumber: string): Promise<void> {
    const response = await apiClient.get(`/cases/${caseId}/audit-trail.xlsx`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${vkNumber || caseId}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}
