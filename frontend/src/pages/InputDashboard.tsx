import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Save, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DuplicateDialog } from '../components/input/DuplicateDialog';
import { AppShell } from '../components/common/AppShell';
import { useCreateCase } from '../hooks/useCases';
import { previewImport, uploadImport } from '../services/imports';
import { useImportOverride } from '../state/importOverride';

const S_OPTIONS = [1, 3, 5, 8, 10];
const PD_OPTIONS = [1, 5, 10];

function CategorySelect({
  label,
  value,
  onChange,
  highlight,
  options,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  highlight?: boolean;
  options: number[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-20 border rounded-lg px-3 py-2 text-sm font-mono text-center outline-none transition-all ${
          highlight
            ? 'border-amber-400 bg-amber-50 focus:ring-2 focus:ring-amber-200'
            : 'border-stone-200 bg-white focus:border-stone-400 focus:ring-2 focus:ring-stone-100'
        }`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export function InputDashboard() {
  const navigate = useNavigate();
  const [vkNumber, setVkNumber] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [triciaS, setTriciaS] = useState<number>(1);
  const [triciaP, setTriciaP] = useState<number>(1);
  const [triciaD, setTriciaD] = useState<number>(1);
  const [userS, setUserS] = useState<number>(1);
  const [userD, setUserD] = useState<number>(1);
  const [userSManual, setUserSManual] = useState(false);
  const [userDManual, setUserDManual] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const createCase = useCreateCase();
  const setPreviewData = useImportOverride((s) => s.setPreviewData);
  const clearPreviewData = useImportOverride((s) => s.clearPreviewData);
  const previewSourceFileName = useImportOverride((s) => s.sourceFileName);
  const previewSourceFile = useImportOverride((s) => s.sourceFile);
  const previewCases = useImportOverride((s) => s.cases);
  const previewControlItems = useImportOverride((s) => s.controlItems);
  const isPreviewOverrideActive = Boolean(previewSourceFileName && previewSourceFile);

  // Autofill user_s from tricia_s if not manually overridden
  useEffect(() => {
    if (!userSManual) setUserS(triciaS);
  }, [triciaS, userSManual]);

  // Autofill user_d from tricia_d if not manually overridden
  useEffect(() => {
    if (!userDManual) setUserD(triciaD);
  }, [triciaD, userDManual]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    setSubmitError(null);
    if (isPreviewOverrideActive && previewSourceFileName && previewSourceFile) {
      const now = new Date().toISOString();
      const today = now.slice(0, 10);
      const nextCase = {
        id: vkNumber.trim(),
        vk_number: vkNumber.trim(),
        device_name: deviceName.trim(),
        analysis_date: today,
        input_timestamp: now,
        wimi_shortcut: undefined,
        validation_status: 'saved',
        tricia_s: triciaS,
        tricia_p: triciaP,
        tricia_d: triciaD,
        user_s: userS,
        user_d: userD,
        category_code: undefined,
        risk_level: 'none',
        is_excluded: false,
        is_reviewed: false,
      };
      const caseIndex = previewCases.findIndex((item) => item.vk_number === nextCase.vk_number);
      const nextCases = [...previewCases];
      if (caseIndex >= 0) {
        nextCases[caseIndex] = nextCase;
      } else {
        nextCases.unshift(nextCase);
      }
      const nextControlItem = {
        vk_number: nextCase.vk_number,
        analysis_date: nextCase.analysis_date,
        input_timestamp: nextCase.input_timestamp,
        wimi_shortcut: nextCase.wimi_shortcut,
        user_id: nextCase.wimi_shortcut,
        validation_status: nextCase.validation_status,
        delay_bucket: 'on_time',
      };
      const controlIndex = previewControlItems.findIndex((item) => item.vk_number === nextControlItem.vk_number);
      const nextControlItems = [...previewControlItems];
      if (controlIndex >= 0) {
        nextControlItems[controlIndex] = nextControlItem;
      } else {
        nextControlItems.unshift(nextControlItem);
      }
      setPreviewData({
        sourceFileName: previewSourceFileName,
        sourceFile: previewSourceFile,
        cases: nextCases,
        controlItems: nextControlItems,
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
      setImportStatus(`Analysis dataset updated in memory (${previewSourceFileName}).`);
      return;
    }
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
    } catch (error) {
      const response = typeof error === 'object' && error && 'response' in error
        ? (error as { response?: { status?: number; data?: unknown } }).response
        : undefined;
      const statusCode = response?.status;
      const responseData = response?.data;
      const errorMessageFromError = error instanceof Error ? error.message : undefined;

      const detailFromData =
        responseData && typeof responseData === 'object' && 'detail' in responseData
          ? (responseData as { detail?: unknown }).detail
          : undefined;
      const errorMessageFromData =
        responseData && typeof responseData === 'object' && 'error' in responseData
          ? (responseData as { error?: { message?: string } }).error?.message
          : undefined;

      const normalizedDetail = Array.isArray(detailFromData)
        ? detailFromData.map((entry) => {
            if (entry && typeof entry === 'object' && 'msg' in entry) {
              return String((entry as { msg?: unknown }).msg ?? '');
            }
            return String(entry);
          }).join('; ')
        : typeof detailFromData === 'string'
          ? detailFromData
          : undefined;

      const backendMessage = errorMessageFromData ?? normalizedDetail;

      if (
        statusCode === 409 ||
        Boolean(backendMessage?.toLowerCase().includes('duplicate')) ||
        Boolean(errorMessageFromError?.toLowerCase().includes('duplicate'))
      ) {
        setDuplicateOpen(true);
        setSubmitError(null);
        return;
      }

      setSubmitError(backendMessage ?? errorMessageFromError ?? 'Save failed. Check the VK number format and required fields.');
    }
  }

  function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setImportFile(nextFile);
    setImportError(null);
    setImportStatus(null);
    if (nextFile) setModeDialogOpen(true);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
  }

  async function handleAnalyzeUpload() {
    if (!importFile) {
      setImportError('Choose a CSV or Excel file first.');
      return;
    }

    setIsPreviewing(true);
    setImportError(null);
    setImportStatus(null);
    try {
      const preview = await previewImport(importFile);
      setPreviewData({
        sourceFileName: importFile.name,
        sourceFile: importFile,
        cases: (preview?.cases ?? []).map((item: { vk_number: string }) => ({
          ...item,
          id: item.vk_number,
        })),
        controlItems: preview?.control_items ?? [],
      });
      setImportStatus(`Preview loaded from ${importFile.name}. Open Matrix/Control dashboards to review it.`);
      setModeDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Preview failed.';
      setImportError(message);
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleImportUpload() {
    if (!importFile) {
      importFileInputRef.current?.click();
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportStatus(null);
    try {
      const result = await uploadImport(importFile);
      clearPreviewData();
      setImportStatus(
        `Imported ${result.imported_rows ?? 0} of ${result.total_rows ?? 0} rows from ${importFile.name}.`
      );
      setModeDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.';
      setImportError(message);
    } finally {
      setIsImporting(false);
    }
  }

  function handleEditExisting(existingVkNumber: string) {
    navigate(`/matrix?vk_number=${encodeURIComponent(existingVkNumber)}`);
    setDuplicateOpen(false);
  }

  function handleChooseFile() {
    setImportError(null);
    setImportStatus(null);
    importFileInputRef.current?.click();
  }

  return (
    <AppShell>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">Input Dashboard</h1>
        <p className="text-stone-500 text-sm mb-6">Enter a new case and save it directly. WiMi corrections can differ from Tricia.</p>
        {isPreviewOverrideActive && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center justify-between gap-3">
            <span>Analysis mode is active for {previewSourceFileName}. Save updates only the uploaded dataset until you import.</span>
            <button className="underline" onClick={clearPreviewData}>Clear</button>
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col gap-6">
          {/* Case identifiers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">VK Number</label>
              <input
                aria-label="vk-number"
                value={vkNumber}
                onChange={(e) => setVkNumber(e.target.value)}
                placeholder="e.g. Vk_20240115_06"
                required
                className="border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-100 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Device Name</label>
              <input
                aria-label="device-name"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Device identifier"
                required
                className="border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-100 transition-all"
              />
            </div>
          </div>

          {/* Classification values */}
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
              TRI Classification
            </p>
            <div className="flex gap-4">
              <CategorySelect label="TRI-S" value={triciaS} onChange={setTriciaS} options={S_OPTIONS} />
              <CategorySelect label="TRI-P" value={triciaP} onChange={setTriciaP} options={PD_OPTIONS} />
              <CategorySelect label="TRI-D" value={triciaD} onChange={setTriciaD} options={PD_OPTIONS} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">
              WIMI Correction
              <span className="ml-2 font-normal text-stone-400 normal-case">
                (auto-filled from TRI values — edit only if different)
              </span>
            </p>
            <div className="flex gap-4 mt-3">
              <CategorySelect
                label="WIMI-S"
                value={userS}
                onChange={(v) => { setUserS(v); setUserSManual(true); }}
                highlight={userSManual && userS !== triciaS}
                options={S_OPTIONS}
              />
              <CategorySelect
                label="WIMI-D"
                value={userD}
                onChange={(v) => { setUserD(v); setUserDManual(true); }}
                highlight={userDManual && userD !== triciaD}
                options={PD_OPTIONS}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-stone-100">
            <button
              type="submit"
              disabled={createCase.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-amber-400 text-stone-900 rounded-lg text-sm font-semibold hover:bg-amber-300 disabled:opacity-50 transition-colors"
            >
              <Save size={15} />
              {createCase.isPending ? 'Saving…' : (isPreviewOverrideActive ? 'Save to analysis' : 'Save')}
            </button>
          </div>
        </form>

        <div className="mt-6 bg-white border border-stone-200 rounded-xl p-6 flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Upload CSV or Excel</h2>
            <p className="text-sm text-stone-500 mt-1">Upload a dataset and then choose Analyze only or Import to DB.</p>
          </div>
          <div className="flex flex-col gap-3">
            <input
              aria-label="import-file"
              type="file"
              accept=".csv,.xlsx"
              ref={importFileInputRef}
              onChange={handleImportFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleChooseFile}
              disabled={isImporting || isPreviewing}
              className="inline-flex w-fit items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-50"
            >
              <Upload size={14} />
              {(isImporting || isPreviewing) ? 'Processing…' : 'Upload dataset'}
            </button>
            {importFile && <p className="text-xs text-stone-500">Selected file: {importFile.name}</p>}
          </div>
          {importError && <p className="text-sm text-red-700">{importError}</p>}
          {importStatus && <p className="text-sm text-emerald-700">{importStatus}</p>}
        </div>

        {submitError && !duplicateOpen && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            <AlertTriangle size={15} />
            <span>{submitError}</span>
          </div>
        )}

        {saved && (
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
            <Save size={15} />
            <span>Case saved. Form cleared — ready for next entry.</span>
          </div>
        )}
      </div>

      <DuplicateDialog
        open={duplicateOpen}
        vkNumber={vkNumber}
        onClose={() => setDuplicateOpen(false)}
        onEditExisting={handleEditExisting}
      />
      {modeDialogOpen && importFile && (
        <div
          role="dialog"
          aria-label="import-mode-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4"
          onClick={() => setModeDialogOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-stone-900">Choose upload mode</h3>
            <p className="mt-1 text-sm text-stone-600">
              File: {importFile.name}
            </p>
            <p className="mt-2 text-xs text-stone-500">
              Analyze keeps data in-memory only. Import writes rows to the database.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModeDialogOpen(false)}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAnalyzeUpload}
                disabled={isPreviewing || isImporting}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100 disabled:opacity-60"
              >
                {isPreviewing ? 'Analyzing…' : 'Analyze only'}
              </button>
              <button
                type="button"
                onClick={handleImportUpload}
                disabled={isImporting || isPreviewing}
                className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700 disabled:opacity-60"
              >
                {isImporting ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
