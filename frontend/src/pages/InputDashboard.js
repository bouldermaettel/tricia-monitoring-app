import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import { DuplicateDialog } from '../components/input/DuplicateDialog';
import { AppShell } from '../components/common/AppShell';
import { useCreateCase } from '../hooks/useCases';
const S_OPTIONS = [1, 3, 5, 8, 10];
const PD_OPTIONS = [1, 5, 10];
function CategorySelect({ label, value, onChange, highlight, options, }) {
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs font-semibold text-stone-500 uppercase tracking-wide", children: label }), _jsx("select", { value: value, onChange: (e) => onChange(Number(e.target.value)), className: `w-20 border rounded-lg px-3 py-2 text-sm font-mono text-center outline-none transition-all ${highlight
                    ? 'border-amber-400 bg-amber-50 focus:ring-2 focus:ring-amber-200'
                    : 'border-stone-200 bg-white focus:border-stone-400 focus:ring-2 focus:ring-stone-100'}`, children: options.map((option) => (_jsx("option", { value: option, children: option }, option))) })] }));
}
export function InputDashboard() {
    const [vkNumber, setVkNumber] = useState('');
    const [deviceName, setDeviceName] = useState('');
    const [triciaS, setTriciaS] = useState(1);
    const [triciaP, setTriciaP] = useState(1);
    const [triciaD, setTriciaD] = useState(1);
    const [userS, setUserS] = useState(1);
    const [userD, setUserD] = useState(1);
    const [userSManual, setUserSManual] = useState(false);
    const [userDManual, setUserDManual] = useState(false);
    const [duplicateOpen, setDuplicateOpen] = useState(false);
    const [saved, setSaved] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const createCase = useCreateCase();
    // Autofill user_s from tricia_s if not manually overridden
    useEffect(() => {
        if (!userSManual)
            setUserS(triciaS);
    }, [triciaS, userSManual]);
    // Autofill user_d from tricia_d if not manually overridden
    useEffect(() => {
        if (!userDManual)
            setUserD(triciaD);
    }, [triciaD, userDManual]);
    async function handleSave(e) {
        e.preventDefault();
        setSaved(false);
        setSubmitError(null);
        try {
            await createCase.mutateAsync({
                vk_number: vkNumber,
                device_name: deviceName,
                tricia_s: triciaS,
                tricia_p: triciaP,
                tricia_d: triciaD,
                user_s: userS,
                user_d: userD,
                validation_status: 'saved',
            });
            setSaved(true);
            setVkNumber('');
            setDeviceName('');
            setTriciaS(1);
            setTriciaP(1);
            setTriciaD(1);
            setUserS(1);
            setUserD(1);
            setUserSManual(false);
            setUserDManual(false);
            setDuplicateOpen(false);
        }
        catch (error) {
            const response = typeof error === 'object' && error && 'response' in error
                ? error.response
                : undefined;
            const statusCode = response?.status;
            const responseData = response?.data;
            const errorMessageFromError = error instanceof Error ? error.message : undefined;
            const detailFromData = responseData && typeof responseData === 'object' && 'detail' in responseData
                ? responseData.detail
                : undefined;
            const errorMessageFromData = responseData && typeof responseData === 'object' && 'error' in responseData
                ? responseData.error?.message
                : undefined;
            const normalizedDetail = Array.isArray(detailFromData)
                ? detailFromData.map((entry) => {
                    if (entry && typeof entry === 'object' && 'msg' in entry) {
                        return String(entry.msg ?? '');
                    }
                    return String(entry);
                }).join('; ')
                : typeof detailFromData === 'string'
                    ? detailFromData
                    : undefined;
            const backendMessage = errorMessageFromData ?? normalizedDetail;
            if (statusCode === 409 ||
                Boolean(backendMessage?.toLowerCase().includes('duplicate')) ||
                Boolean(errorMessageFromError?.toLowerCase().includes('duplicate'))) {
                setDuplicateOpen(true);
                setSubmitError(null);
                return;
            }
            setSubmitError(backendMessage ?? errorMessageFromError ?? 'Save failed. Check the VK number format and required fields.');
        }
    }
    return (_jsxs(AppShell, { children: [_jsxs("div", { className: "max-w-2xl", children: [_jsx("h1", { className: "text-2xl font-bold text-stone-900 mb-1", children: "Input Dashboard" }), _jsx("p", { className: "text-stone-500 text-sm mb-6", children: "Enter a new case and save it directly. WiMi corrections can differ from Tricia." }), _jsxs("form", { onSubmit: handleSave, className: "bg-white border border-stone-200 rounded-xl p-6 flex flex-col gap-6", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "VK Number" }), _jsx("input", { "aria-label": "vk-number", value: vkNumber, onChange: (e) => setVkNumber(e.target.value), placeholder: "e.g. Vk_20240115_06", required: true, className: "border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-100 transition-all" })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "Device Name" }), _jsx("input", { "aria-label": "device-name", value: deviceName, onChange: (e) => setDeviceName(e.target.value), placeholder: "Device identifier", required: true, className: "border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-100 transition-all" })] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3", children: "TRI Classification" }), _jsxs("div", { className: "flex gap-4", children: [_jsx(CategorySelect, { label: "TRI-S", value: triciaS, onChange: setTriciaS, options: S_OPTIONS }), _jsx(CategorySelect, { label: "TRI-P", value: triciaP, onChange: setTriciaP, options: PD_OPTIONS }), _jsx(CategorySelect, { label: "TRI-D", value: triciaD, onChange: setTriciaD, options: PD_OPTIONS })] })] }), _jsxs("div", { children: [_jsxs("p", { className: "text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1", children: ["WIMI Correction", _jsx("span", { className: "ml-2 font-normal text-stone-400 normal-case", children: "(auto-filled from TRI values \u2014 edit only if different)" })] }), _jsxs("div", { className: "flex gap-4 mt-3", children: [_jsx(CategorySelect, { label: "WIMI-S", value: userS, onChange: (v) => { setUserS(v); setUserSManual(true); }, highlight: userSManual && userS !== triciaS, options: S_OPTIONS }), _jsx(CategorySelect, { label: "WIMI-D", value: userD, onChange: (v) => { setUserD(v); setUserDManual(true); }, highlight: userDManual && userD !== triciaD, options: PD_OPTIONS })] })] }), _jsx("div", { className: "flex items-center gap-3 pt-2 border-t border-stone-100", children: _jsxs("button", { type: "submit", disabled: createCase.isPending, className: "flex items-center gap-2 px-4 py-2 bg-amber-400 text-stone-900 rounded-lg text-sm font-semibold hover:bg-amber-300 disabled:opacity-50 transition-colors", children: [_jsx(Save, { size: 15 }), createCase.isPending ? 'Saving…' : 'Save'] }) })] }), submitError && !duplicateOpen && (_jsxs("div", { className: "mt-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5", children: [_jsx(AlertTriangle, { size: 15 }), _jsx("span", { children: submitError })] })), saved && (_jsxs("div", { className: "mt-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5", children: [_jsx(Save, { size: 15 }), _jsx("span", { children: "Case saved. Form cleared \u2014 ready for next entry." })] }))] }), _jsx(DuplicateDialog, { open: duplicateOpen, onClose: () => setDuplicateOpen(false) })] }));
}
