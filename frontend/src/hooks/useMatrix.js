import { useQuery } from '@tanstack/react-query';
import { getConfusionMatrix } from '../services/matrices';
export function useMatrix(params) {
    return useQuery({ queryKey: ['matrix', params], queryFn: () => getConfusionMatrix(params) });
}
