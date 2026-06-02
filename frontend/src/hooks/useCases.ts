import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    addCaseComment,
    bulkDeleteCases,
    createCase,
    deleteCase,
    getCaseAuditTrail,
    listCases,
    patchCaseReview,
    updateCase,
    validateCase,
} from '../services/cases';

export function useCases(params?: Record<string, unknown>, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['cases', params],
        queryFn: () => listCases(params),
        enabled: options?.enabled ?? true,
        placeholderData: keepPreviousData,
    });
}

export function useValidateCase() {
    return useMutation({ mutationFn: validateCase });
}

export function useCreateCase() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createCase,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cases'] });
        },
    });
}

export function usePatchCaseReview() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ caseId, payload }: { caseId: string; payload: Record<string, unknown> }) => patchCaseReview(caseId, payload),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['cases'] });
            queryClient.invalidateQueries({ queryKey: ['matrix'] });
            queryClient.invalidateQueries({ queryKey: ['case-audit', variables.caseId] });
        },
    });
}

export function useAddCaseComment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ caseId, text }: { caseId: string; text: string }) => addCaseComment(caseId, text),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['cases'] });
            queryClient.invalidateQueries({ queryKey: ['case-audit', variables.caseId] });
        },
    });
}

export function useUpdateCase() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ caseId, payload }: { caseId: string; payload: Record<string, unknown> }) => updateCase(caseId, payload),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['cases'] });
            queryClient.invalidateQueries({ queryKey: ['matrix'] });
            queryClient.invalidateQueries({ queryKey: ['control'] });
            queryClient.invalidateQueries({ queryKey: ['case-audit', variables.caseId] });
        },
    });
}

export function useDeleteCase() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (caseId: string) => deleteCase(caseId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cases'] });
            queryClient.invalidateQueries({ queryKey: ['matrix'] });
            queryClient.invalidateQueries({ queryKey: ['control'] });
        },
    });
}

export function useBulkDeleteCases() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (caseIds: string[]) => bulkDeleteCases(caseIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cases'] });
            queryClient.invalidateQueries({ queryKey: ['matrix'] });
            queryClient.invalidateQueries({ queryKey: ['control'] });
        },
    });
}

export function useCaseAuditTrail(caseId?: string, limit = 100) {
    return useQuery({
        queryKey: ['case-audit', caseId, limit],
        queryFn: () => getCaseAuditTrail(caseId as string, limit),
        enabled: Boolean(caseId),
    });
}
