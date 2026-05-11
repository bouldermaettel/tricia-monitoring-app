import { create } from 'zustand';

type PreviewCase = {
    id?: string;
    vk_number: string;
    device_name: string;
    analysis_date: string;
    input_timestamp?: string;
    wimi_shortcut?: string;
    validation_status: string;
    tricia_s: number;
    tricia_p: number;
    tricia_d: number;
    user_s: number;
    user_d: number;
    category_code?: string;
    risk_level?: string;
    is_excluded?: boolean;
    is_reviewed?: boolean;
};

type PreviewControlItem = {
    vk_number: string;
    analysis_date: string;
    date_reported?: string;
    input_timestamp?: string;
    wimi_shortcut?: string;
    user_id?: string;
    validation_status: string;
    delay_bucket: string;
};

type ImportOverrideState = {
    sourceFileName?: string;
    sourceFile?: File;
    cases: PreviewCase[];
    controlItems: PreviewControlItem[];
    setPreviewData: (payload: {
        sourceFileName: string;
        sourceFile: File;
        cases: PreviewCase[];
        controlItems: PreviewControlItem[];
    }) => void;
    clearPreviewData: () => void;
};

export const useImportOverride = create<ImportOverrideState>((set) => ({
    sourceFileName: undefined,
    sourceFile: undefined,
    cases: [],
    controlItems: [],
    setPreviewData: (payload) =>
        set({
            sourceFileName: payload.sourceFileName,
            sourceFile: payload.sourceFile,
            cases: payload.cases,
            controlItems: payload.controlItems,
        }),
    clearPreviewData: () =>
        set({
            sourceFileName: undefined,
            sourceFile: undefined,
            cases: [],
            controlItems: [],
        }),
}));
