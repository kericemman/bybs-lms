import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, DataTable, PageHeader } from "@bybs/shared";
import { inputClassName } from "../components/FormField.jsx";
import { adminApi } from "../services/api.js";
import { formatDateTime, relatedTitle } from "../utils/format.js";

export function SystemLogsPage() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ action: "", statusCode: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .listSystemLogs(filters)
      .then((response) => setLogs(response.data))
      .catch((requestError) => setError(requestError.message));
  }, [filters]);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Track operational events, failed actions, and errors that need admin attention."
        title="System logs"
      />
      <div className="grid gap-3 rounded-lg border border-bybs-border bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-bybs-muted" aria-hidden="true" />
          <input
            className={`${inputClassName} pl-9`}
            onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}
            placeholder="Filter by action"
            value={filters.action}
          />
        </div>
        <select
          className={inputClassName}
          onChange={(event) => setFilters((current) => ({ ...current, statusCode: event.target.value }))}
          value={filters.statusCode}
        >
          <option value="">All statuses</option>
          <option value="200">200 OK</option>
          <option value="201">201 Created</option>
          <option value="400">400 Validation</option>
          <option value="403">403 Forbidden</option>
          <option value="409">409 Conflict</option>
          <option value="500">500 Server</option>
        </select>
        <Button
          icon={X}
          onClick={() => setFilters({ action: "", statusCode: "" })}
          type="button"
          variant="secondary"
        >
          Reset
        </Button>
      </div>
      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      <DataTable
        columns={[
          { key: "action", header: "Action" },
          { key: "user", header: "User", render: (row) => relatedTitle(row.user, "System") },
          { key: "route", header: "Route" },
          { key: "statusCode", header: "Status" },
          { key: "createdAt", header: "Created", render: (row) => formatDateTime(row.createdAt) }
        ]}
        emptyDescription="Security and application events will appear here as logging expands."
        rows={logs}
      />
    </div>
  );
}
