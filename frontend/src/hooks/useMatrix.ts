import { useQuery } from '@tanstack/react-query';
import { getConfusionMatrix } from '../services/matrices';

export function useMatrix(params?: Record<string, unknown>, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['matrix', params],
        queryFn: () => getConfusionMatrix(params),
        enabled: options?.enabled ?? true,
    });
}
