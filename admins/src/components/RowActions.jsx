import { Edit3, Trash2 } from "lucide-react";
import { Button } from "@bybs/shared";

export function RowActions({ onEdit, onDelete, deleteLabel = "Delete", confirmMessage }) {
  function handleDelete() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    onDelete?.();
  }

  return (
    <div className="flex items-center gap-2">
      {onEdit ? (
        <Button aria-label="Edit" icon={Edit3} onClick={onEdit} size="sm" type="button" variant="secondary">
          Edit
        </Button>
      ) : null}
      {onDelete ? (
        <Button aria-label={deleteLabel} icon={Trash2} onClick={handleDelete} size="sm" type="button" variant="danger">
          {deleteLabel}
        </Button>
      ) : null}
    </div>
  );
}
