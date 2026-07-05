import { EmptyState } from "./EmptyState.jsx";

export function DataTable({
  columns,
  rows,
  emptyTitle = "No records yet",
  emptyDescription,
  emptyActionLabel,
  onEmptyAction
}) {
  if (!rows?.length) {
    return (
      <EmptyState
        actionLabel={emptyActionLabel}
        description={emptyDescription}
        onAction={onEmptyAction}
        title={emptyTitle}
      />
    );
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-bybs-border bg-white shadow-sm">
      <div className="max-w-full overflow-x-auto">
        <table className="min-w-full divide-y divide-bybs-border">
          <thead className="bg-bybs-pale">
            <tr>
              {columns.map((column) => (
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase text-bybs-muted"
                  key={column.key}
                  scope="col"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-bybs-border">
            {rows.map((row, rowIndex) => (
              <tr className="hover:bg-bybs-pale" key={row.id || row._id || rowIndex}>
                {columns.map((column) => (
                  <td
                    className={column.wrap ? "px-4 py-3 text-sm text-bybs-body" : "whitespace-nowrap px-4 py-3 text-sm text-bybs-body"}
                    key={column.key}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
