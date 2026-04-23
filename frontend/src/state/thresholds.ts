import { create } from 'zustand';

type ThresholdState = {
  acceptanceThreshold: number;
  problemThreshold: number;
  includeExcludedDefault: boolean;
  setThresholds: (acceptance: number, problem: number, includeExcluded: boolean) => void;
};

export const useThresholdState = create<ThresholdState>((set) => ({
  acceptanceThreshold: 1,
  problemThreshold: 3,
  includeExcludedDefault: false,
  setThresholds: (acceptance, problem, includeExcluded) =>
    set({ acceptanceThreshold: acceptance, problemThreshold: problem, includeExcludedDefault: includeExcluded }),
}));
