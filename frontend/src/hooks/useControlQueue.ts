import { useQuery } from '@tanstack/react-query';
import { getControlQueue } from '../services/control';

export function useControlQueue(params?: Record<string, unknown>) {
  return useQuery({ queryKey: ['control', params], queryFn: () => getControlQueue(params) });
}
