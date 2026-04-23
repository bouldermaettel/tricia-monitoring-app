import { jsx as _jsx } from "react/jsx-runtime";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo } from 'react';
import { AuthProvider } from './auth';
export function AppProviders({ children }) {
    const queryClient = useMemo(() => new QueryClient(), []);
    return (_jsx(AuthProvider, { children: _jsx(QueryClientProvider, { client: queryClient, children: children }) }));
}
