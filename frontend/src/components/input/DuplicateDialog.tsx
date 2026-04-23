type DuplicateDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function DuplicateDialog({ open, onClose }: DuplicateDialogProps) {
  if (!open) return null;
  return (
    <div role="dialog" aria-label="duplicate-dialog">
      <p>Duplicate VK number detected. Please edit or cancel.</p>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
