import { AlertTriangle, X } from 'lucide-react';

type DuplicateDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function DuplicateDialog({ open, onClose }: DuplicateDialogProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-label="duplicate-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-stone-200 p-6 w-full max-w-sm mx-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle size={18} className="text-amber-600" />
            </div>
            <h2 className="text-base font-semibold text-stone-900">Duplicate VK Number</h2>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-stone-600 mb-6">
          A case with this VK number already exists. Please edit the existing entry or cancel to start over.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors"
          >
            Edit existing
          </button>
        </div>
      </div>
    </div>
  );
}
