import { create } from 'zustand';
export const useThresholdState = create((set) => ({
    acceptanceThreshold: 1,
    problemThreshold: 3,
    includeExcludedDefault: false,
    setThresholds: (acceptance, problem, includeExcluded) => set({ acceptanceThreshold: acceptance, problemThreshold: problem, includeExcludedDefault: includeExcluded }),
}));
