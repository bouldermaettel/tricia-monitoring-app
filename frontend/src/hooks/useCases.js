import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addCaseComment, createCase, listCases, patchCaseReview, validateCase } from '../services/cases';
export function useCases(params) {
    return useQuery({ queryKey: ['cases', params], queryFn: () => listCases(params) });
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cases'] });
            queryClient.invalidateQueries({ queryKey: ['matrix'] });
        },
    });
}
export function useAddCaseComment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ caseId, text }) => addCaseComment(caseId, text),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cases'] });
        },
    });
}
