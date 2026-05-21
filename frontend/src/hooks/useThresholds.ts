import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getThresholds, updateThresholds } from '../services/config';

export function useThresholds() {
    return useQuery({ queryKey: ['thresholds'], queryFn: getThresholds });
}

export function useUpdateThresholds() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateThresholds,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['thresholds'] });
            queryClient.invalidateQueries({ queryKey: ['cases'] });
            queryClient.invalidateQueries({ queryKey: ['matrix'] });
        },
    });
}
