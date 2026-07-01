import { Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, DataTable, PageHeader, StatusBadge } from "@bybs/shared";
import { FilterBar } from "../components/FilterBar.jsx";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { RowActions } from "../components/RowActions.jsx";
import { adminApi } from "../services/api.js";

const initialForm = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  status: "draft"
};

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" }
];

function toDateInput(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function CohortsPage() {
  const [cohorts, setCohorts] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadCohorts(nextFilters = filters) {
    const response = await adminApi.listCohorts(nextFilters);
    setCohorts(response.data);
  }

  useEffect(() => {
    loadCohorts().catch((requestError) => setError(requestError.message));
  }, [filters]);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  function startEdit(cohort) {
    setEditingId(cohort._id);
    setForm({
      title: cohort.title || "",
      description: cohort.description || "",
      startDate: toDateInput(cohort.startDate),
      endDate: toDateInput(cohort.endDate),
      status: cohort.status || "draft"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(cohort) {
    setError("");

    try {
      await adminApi.deleteCohort(cohort._id);
      await loadCohorts();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (editingId) {
        await adminApi.updateCohort(editingId, form);
      } else {
        await adminApi.createCohort(form);
      }
      resetForm();
      await loadCohorts();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Organize students, mentors, modules, sessions, assignments, announcements, and rankings."
        title="Cohorts"
      />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters({ search: "", status: "" })}
        statuses={statusOptions}
      />

      <Card>
        <form className="grid gap-4 lg:grid-cols-4" onSubmit={handleSubmit}>
          <FormField label="Cohort title">
            <input
              className={inputClassName}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="BYBS Fellowship Cohort 4"
              required
              value={form.title}
            />
          </FormField>
          <FormField label="Start date">
            <input
              className={inputClassName}
              onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
              type="date"
              value={form.startDate}
            />
          </FormField>
          <FormField label="End date">
            <input
              className={inputClassName}
              onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
              type="date"
              value={form.endDate}
            />
          </FormField>
          <FormField label="Status">
            <select
              className={inputClassName}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              value={form.status}
            >
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </FormField>
          <div className="lg:col-span-4">
            <FormField label="Description">
              <textarea
                className={textAreaClassName}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                value={form.description}
              />
            </FormField>
          </div>
          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-4">{error}</p> : null}
          <div className="flex flex-wrap gap-2 lg:col-span-4">
            <Button disabled={isSubmitting} icon={editingId ? Save : Plus} type="submit">
              {isSubmitting ? "Saving..." : editingId ? "Update cohort" : "Create cohort"}
            </Button>
            {editingId ? (
              <Button icon={X} onClick={resetForm} type="button" variant="secondary">
                Cancel edit
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <DataTable
        columns={[
          { key: "title", header: "Cohort" },
          { key: "students", header: "Students", render: (row) => row.students?.length || 0 },
          { key: "mentors", header: "Mentors", render: (row) => row.mentors?.length || 0 },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <RowActions
                confirmMessage={`Delete ${row.title}? This cannot be undone.`}
                onDelete={() => handleDelete(row)}
                onEdit={() => startEdit(row)}
              />
            )
          }
        ]}
        rows={cohorts}
      />
    </div>
  );
}
