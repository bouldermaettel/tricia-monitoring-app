import { create } from 'zustand';
export const useFilters = create((set) => ({
    includeExcluded: false,
    problematicOnly: false,
    selectedExpected: undefined,
    selectedObserved: undefined,
    selectedDimension: 'detectability',
    dateWindow: '3M',
    dateFrom: undefined,
    dateTo: undefined,
    riskFilter: 'all',
    setIncludeExcluded: (value) => set({ includeExcluded: value }),
    setProblematicOnly: (value) => set({ problematicOnly: value }),
    setSelectedCell: (dimension, expected, observed) => set({ selectedDimension: dimension, selectedExpected: expected, selectedObserved: observed }),
    setDateWindow: (window) => set({ dateWindow: window }),
    setCustomDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),
    setRiskFilter: (filter) => set({ riskFilter: filter }),
}));
