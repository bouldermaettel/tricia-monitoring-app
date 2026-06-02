import { useEffect, useMemo, useState } from 'react';
import { Settings } from 'lucide-react';
import { useThresholds, useUpdateThresholds } from '../../hooks/useThresholds';

type RiskCategory = {
  label: string;
  min_value: number;
  max_value: number;
};

type ProblematicCaseThresholds = {
  '3M': number;
  '6M': number;
  '12M': number;
};

const DEFAULT_RISK_CATEGORIES: RiskCategory[] = [
  { label: '0-10', min_value: 0, max_value: 10 },
  { label: '11-250', min_value: 11, max_value: 250 },
  { label: '251-500', min_value: 251, max_value: 500 },
  { label: '501-1000', min_value: 501, max_value: 1000 },
];

function normalizeCategories(input: unknown): RiskCategory[] {
  if (!Array.isArray(input) || input.length === 0) return DEFAULT_RISK_CATEGORIES;

  const normalized = input
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<RiskCategory>;
      const minValue = Number(candidate.min_value);
      const maxValue = Number(candidate.max_value);
      if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) return null;
      return {
        label: (candidate.label ?? `Category ${index + 1}`).toString(),
        min_value: Math.max(0, Math.trunc(minValue)),
        max_value: Math.max(0, Math.trunc(maxValue)),
      };
    })
    .filter((item): item is RiskCategory => item !== null)
    .sort((a, b) => a.min_value - b.min_value);

  return normalized.length > 0 ? normalized : DEFAULT_RISK_CATEGORIES;
}

function normalizeProblematicCaseThresholds(input: unknown): ProblematicCaseThresholds {
  if (!input || typeof input !== 'object') {
    return { '3M': 10, '6M': 20, '12M': 40 };
  }
  const raw = input as Partial<Record<'3M' | '6M' | '12M', unknown>>;
  return {
    '3M': Number.isFinite(Number(raw['3M'])) ? Math.max(0, Math.trunc(Number(raw['3M']))) : 10,
    '6M': Number.isFinite(Number(raw['6M'])) ? Math.max(0, Math.trunc(Number(raw['6M']))) : 20,
    '12M': Number.isFinite(Number(raw['12M'])) ? Math.max(0, Math.trunc(Number(raw['12M']))) : 40,
  };
}

function toBoundaryValue(value: number): number {
  return Math.max(0, Math.trunc(Number(value) || 0));
}

function withRangeLabels(categories: RiskCategory[]): RiskCategory[] {
  return categories.map((category) => ({
    ...category,
    label: `${category.min_value}-${category.max_value}`,
  }));
}

export function ThresholdConfigPanel() {
  const { data } = useThresholds();
  const update = useUpdateThresholds();
  const [acceptance, setAcceptance] = useState<number>(data?.acceptance_threshold ?? 1);
  const [problematicCaseThresholds, setProblematicCaseThresholds] = useState<ProblematicCaseThresholds>({
    '3M': 10,
    '6M': 20,
    '12M': 40,
  });
  const [categories, setCategories] = useState<RiskCategory[]>(DEFAULT_RISK_CATEGORIES);
  const [boundaryDrafts, setBoundaryDrafts] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setAcceptance(data?.acceptance_threshold ?? 1);
    setProblematicCaseThresholds(normalizeProblematicCaseThresholds(data?.problematic_case_thresholds));
    setCategories(withRangeLabels(normalizeCategories(data?.risk_categories)));
    setBoundaryDrafts({});
  }, [data]);

  const hasCategoryError = useMemo(() => {
    if (categories.length === 0) return true;
    const sorted = [...categories].sort((a, b) => a.min_value - b.min_value);
    return sorted.some((item, index) => {
      if (item.min_value > item.max_value) return true;
      if (index === 0) return false;
      return sorted[index - 1].max_value >= item.min_value;
    });
  }, [categories]);

  function addCategory() {
    const sorted = [...categories].sort((a, b) => a.min_value - b.min_value);
    const last = sorted[sorted.length - 1] ?? { min_value: 0, max_value: 0 };
    const nextMin = last.max_value + 1;
    const nextMax = nextMin + 100;
    setCategories(
      withRangeLabels([
        ...sorted,
        {
          label: `${nextMin}-${nextMax}`,
          min_value: nextMin,
          max_value: nextMax,
        },
      ])
    );
    setBoundaryDrafts({});
  }

  function getBoundaryDraftKey(index: number, boundary: 'min_value' | 'max_value') {
    return `${index}-${boundary}`;
  }

  function updateCategoryBoundary(index: number, boundary: 'min_value' | 'max_value', rawValue: number) {
    setCategories((previous) => {
      const next = previous.map((item) => ({ ...item }));
      const newValue = toBoundaryValue(rawValue);

      if (boundary === 'min_value') {
        next[index].min_value = newValue;
        if (index > 0) {
          next[index - 1].max_value = Math.max(next[index - 1].min_value, newValue - 1);
        }
        if (next[index].max_value < next[index].min_value) {
          next[index].max_value = next[index].min_value;
        }
      } else {
        next[index].max_value = Math.max(newValue, next[index].min_value);
      }

      for (let cursor = index + 1; cursor < next.length; cursor += 1) {
        next[cursor].min_value = next[cursor - 1].max_value + 1;
        if (next[cursor].max_value < next[cursor].min_value) {
          next[cursor].max_value = next[cursor].min_value;
        }
      }

      return withRangeLabels(next);
    });
  }

  function commitCategoryBoundary(index: number, boundary: 'min_value' | 'max_value') {
    const key = getBoundaryDraftKey(index, boundary);
    const draftValue = boundaryDrafts[key];
    if (draftValue === undefined) return;
    updateCategoryBoundary(index, boundary, Number(draftValue));
    setBoundaryDrafts((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  function removeCategory(index: number) {
    setCategories((previous) => previous.filter((_, i) => i !== index));
    setBoundaryDrafts({});
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
      >
        <Settings size={15} />
        Settings
        <span className="ml-auto text-stone-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-stone-100 px-4 py-4 flex flex-col gap-5">
          <div className="flex flex-wrap items-end gap-6">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Acceptance threshold</label>
            <p className="text-xs text-stone-400 mb-1">Current: {data?.acceptance_threshold ?? '—'}</p>
            <input
              type="number"
              min={0}
              max={5}
              value={acceptance}
              onChange={(e) => setAcceptance(Number(e.target.value))}
              className="w-24 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">#Problematic Cases</label>
            <p className="text-xs text-stone-400 mb-1">Thresholds for optical alarm by period.</p>
            <div className="flex items-center gap-2">
              <label className="text-xs text-stone-500">3M</label>
              <input
                type="number"
                min={0}
                value={problematicCaseThresholds['3M']}
                onChange={(e) =>
                  setProblematicCaseThresholds((previous) => ({
                    ...previous,
                    '3M': Math.max(0, Math.trunc(Number(e.target.value) || 0)),
                  }))
                }
                className="w-20 border border-stone-200 rounded-lg px-2 py-2 text-sm font-mono outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
              <label className="text-xs text-stone-500">6M</label>
              <input
                type="number"
                min={0}
                value={problematicCaseThresholds['6M']}
                onChange={(e) =>
                  setProblematicCaseThresholds((previous) => ({
                    ...previous,
                    '6M': Math.max(0, Math.trunc(Number(e.target.value) || 0)),
                  }))
                }
                className="w-20 border border-stone-200 rounded-lg px-2 py-2 text-sm font-mono outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
              <label className="text-xs text-stone-500">12M</label>
              <input
                type="number"
                min={0}
                value={problematicCaseThresholds['12M']}
                onChange={(e) =>
                  setProblematicCaseThresholds((previous) => ({
                    ...previous,
                    '12M': Math.max(0, Math.trunc(Number(e.target.value) || 0)),
                  }))
                }
                className="w-20 border border-stone-200 rounded-lg px-2 py-2 text-sm font-mono outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Risk Class Categories</p>
                <p className="text-xs text-stone-400">Define value boundaries for the Risk Class Matrix.</p>
              </div>
              <button
                type="button"
                onClick={addCategory}
                className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                Add Category
              </button>
            </div>

            <div className="grid gap-2">
              <div className="grid grid-cols-[auto_auto_auto_auto] gap-2 items-center text-[11px] font-semibold uppercase tracking-wide text-stone-500 px-1">
                <span>Class</span>
                <span>Lower boundary</span>
                <span>Upper boundary</span>
                <span className="text-right">Action</span>
              </div>
              {categories.map((category, index) => (
                <div key={index} className="grid grid-cols-[auto_auto_auto_auto] gap-2 items-center">
                  <span className="text-sm text-stone-700 px-2 py-2">Class {index + 1}</span>
                  <input
                    type="number"
                    min={0}
                    value={boundaryDrafts[getBoundaryDraftKey(index, 'min_value')] ?? String(category.min_value)}
                    onChange={(e) =>
                      setBoundaryDrafts((previous) => ({
                        ...previous,
                        [getBoundaryDraftKey(index, 'min_value')]: e.target.value,
                      }))
                    }
                    onBlur={() => commitCategoryBoundary(index, 'min_value')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    className="w-24 border border-stone-200 rounded-lg px-2 py-2 text-sm font-mono outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    aria-label={`category-${index + 1}-min`}
                  />
                  <input
                    type="number"
                    min={0}
                    value={boundaryDrafts[getBoundaryDraftKey(index, 'max_value')] ?? String(category.max_value)}
                    onChange={(e) =>
                      setBoundaryDrafts((previous) => ({
                        ...previous,
                        [getBoundaryDraftKey(index, 'max_value')]: e.target.value,
                      }))
                    }
                    onBlur={() => commitCategoryBoundary(index, 'max_value')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    className="w-24 border border-stone-200 rounded-lg px-2 py-2 text-sm font-mono outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    aria-label={`category-${index + 1}-max`}
                  />
                  <button
                    type="button"
                    onClick={() => removeCategory(index)}
                    disabled={categories.length <= 1}
                    className="px-2 py-2 text-xs rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {hasCategoryError && (
              <p className="text-xs text-red-600">
                Categories must have non-overlapping ranges and min must be less than or equal to max.
              </p>
            )}
          </div>

          <button
            onClick={() =>
              update.mutate({
                config_key: 'default',
                acceptance_threshold: acceptance,
                problematic_case_thresholds: problematicCaseThresholds,
                include_excluded_default: false,
                risk_categories: categories,
              })
            }
            disabled={update.isPending || hasCategoryError}
            className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
