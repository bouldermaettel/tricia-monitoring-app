import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addCaseComment, bulkDeleteCases, createCase, deleteCase, getCaseAuditTrail, listCases, patchCaseReview, updateCase, validateCase, } from '../services/cases';
export function useCases(params, options) {
    return useQuery({
        queryKey: ['cases', params],
        queryFn: () => listCases(params),
        enabled: options?.enabled ?? true,
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
        mutationFn: ({ caseId, payload }) => patchCaseReview(caseId, payload),
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
        mutationFn: ({ caseId, text }) => addCaseComment(caseId, text),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['cases'] });
            queryClient.invalidateQueries({ queryKey: ['case-audit', variables.caseId] });
        },
    });
}
export function useUpdateCase() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ caseId, payload }) => updateCase(caseId, payload),
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
        mutationFn: (caseId) => deleteCase(caseId),
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
        mutationFn: (caseIds) => bulkDeleteCases(caseIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cases'] });
            queryClient.invalidateQueries({ queryKey: ['matrix'] });
            queryClient.invalidateQueries({ queryKey: ['control'] });
        },
    });
}
export function useCaseAuditTrail(caseId, limit = 100) {
    return useQuery({
        queryKey: ['case-audit', caseId, limit],
        queryFn: () => getCaseAuditTrail(caseId, limit),
        enabled: Boolean(caseId),
    });
}
