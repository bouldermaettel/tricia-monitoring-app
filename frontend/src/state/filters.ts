import { create } from 'zustand';

type FiltersState = {
  includeExcluded: boolean;
  problematicOnly: boolean;
  selectedExpected?: number;
  selectedObserved?: number;
  setIncludeExcluded: (value: boolean) => void;
  setProblematicOnly: (value: boolean) => void;
  setSelectedCell: (expected?: number, observed?: number) => void;
};

export const useFilters = create<FiltersState>((set) => ({
  includeExcluded: false,
  problematicOnly: false,
  selectedExpected: undefined,
  selectedObserved: undefined,
  setIncludeExcluded: (value) => set({ includeExcluded: value }),
  setProblematicOnly: (value) => set({ problematicOnly: value }),
  setSelectedCell: (expected, observed) => set({ selectedExpected: expected, selectedObserved: observed }),
}));
