import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

type Item = { delay_bucket: string };

export function DelaySummary({ items }: { items: Item[] }) {
  const total = items.length;
  const onTime = items.filter((i) => i.delay_bucket === 'on_time').length;
  const delayed = total - onTime;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center">
          <Clock size={18} className="text-stone-500" />
        </div>
        <div>
          <p className="text-2xl font-bold text-stone-900">{total}</p>
          <p className="text-xs text-stone-500">Total entries</p>
        </div>
      </div>
      <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle size={18} className="text-emerald-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-emerald-700">{onTime}</p>
          <p className="text-xs text-stone-500">On time</p>
        </div>
      </div>
      <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle size={18} className="text-red-500" />
        </div>
        <div>
          <p className="text-2xl font-bold text-red-600">{delayed}</p>
          <p className="text-xs text-stone-500">Delayed</p>
        </div>
      </div>
    </div>
  );
}
