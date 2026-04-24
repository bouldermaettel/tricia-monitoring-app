import { useQuery } from '@tanstack/react-query';
import { getControlQueue } from '../services/control';
export function useControlQueue(params, options) {
    return useQuery({
        queryKey: ['control', params],
        queryFn: () => getControlQueue(params),
        enabled: options?.enabled ?? true,
    });
}
