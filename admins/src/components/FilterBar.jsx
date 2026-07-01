import { Button } from "@bybs/shared";
import { Search, X } from "lucide-react";
import { inputClassName } from "./FormField.jsx";

export function FilterBar({ filters, onChange, onReset, cohorts = [], statuses = [], placeholder = "Search" }) {
  return (
    <div className="grid gap-3 rounded-lg border border-bybs-border bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_220px_auto]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-bybs-muted" aria-hidden="true" />
        <input
          className={`${inputClassName} pl-9`}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder={placeholder}
          value={filters.search || ""}
        />
      </div>
      <select
        className={inputClassName}
        onChange={(event) => onChange({ ...filters, cohort: event.target.value })}
        value={filters.cohort || ""}
      >
        <option value="">All cohorts</option>
        {cohorts.map((cohort) => (
          <option key={cohort._id} value={cohort._id}>
            {cohort.title}
          </option>
        ))}
      </select>
      <select
        className={inputClassName}
        onChange={(event) => onChange({ ...filters, status: event.target.value })}
        value={filters.status || ""}
      >
        <option value="">All statuses</option>
        {statuses.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>
      <Button icon={X} onClick={onReset} type="button" variant="secondary">
        Reset
      </Button>
    </div>
  );
}
