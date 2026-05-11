import { Clock } from 'lucide-react';

type Item = Record<string, unknown>;

export function DelaySummary({ items }: { items: Item[] }) {
  const total = items.length;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center">
          <Clock size={18} className="text-stone-500" />
        </div>
        <div>
          <p className="text-2xl font-bold text-stone-900">{total}</p>
          <p className="text-xs text-stone-500">Total entries</p>
        </div>
      </div>
    </div>
  );
}
