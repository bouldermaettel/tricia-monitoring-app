import { create } from 'zustand';
export const useImportOverride = create((set) => ({
    sourceFileName: undefined,
    sourceFile: undefined,
    cases: [],
    controlItems: [],
    setPreviewData: (payload) => set({
        sourceFileName: payload.sourceFileName,
        sourceFile: payload.sourceFile,
        cases: payload.cases,
        controlItems: payload.controlItems,
    }),
    clearPreviewData: () => set({
        sourceFileName: undefined,
        sourceFile: undefined,
        cases: [],
        controlItems: [],
    }),
}));
