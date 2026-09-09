import { create } from 'zustand';

export type DateWindow = '3M' | '6M' | '12M' | 'ALL' | 'CUSTOM';
export type RiskFilter = 'all' | 'false_low' | 'false_high';
export type MatrixDimension = 'severity' | 'probability' | 'detectability' | 'risk' | 'product';

type FiltersState = {
    includeExcluded: boolean;
    problematicOnly: boolean;
    selectedExpected?: number;
    selectedObserved?: number;
    selectedDimension: MatrixDimension;
    dateWindow: DateWindow;
    dateFrom?: string;
    dateTo?: string;
    riskFilter: RiskFilter;
    setIncludeExcluded: (value: boolean) => void;
    setProblematicOnly: (value: boolean) => void;
    setSelectedCell: (dimension: MatrixDimension, expected?: number, observed?: number) => void;
    setDateWindow: (window: DateWindow) => void;
    setCustomDateRange: (from: string, to: string) => void;
    setRiskFilter: (filter: RiskFilter) => void;
};

export const useFilters = create<FiltersState>((set) => ({
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
    setSelectedCell: (dimension, expected, observed) =>
        set({ selectedDimension: dimension, selectedExpected: expected, selectedObserved: observed }),
    setDateWindow: (window) => set({ dateWindow: window }),
    setCustomDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),
    setRiskFilter: (filter) => set({ riskFilter: filter }),
}));
