import { Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, DataTable, PageHeader, StatusBadge } from "@bybs/shared";
import { FilterBar } from "../components/FilterBar.jsx";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { RowActions } from "../components/RowActions.jsx";
import { adminApi } from "../services/api.js";

const initialForm = {
  title: "",
  instructions: "",
  cohort: "",
  dueDate: "",
  maxScore: 100,
  status: "draft",
  allowResubmission: true
};

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" }
];

function toDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function AssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [filters, setFilters] = useState({ search: "", cohort: "", status: "" });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadData() {
    const [assignmentResponse, cohortResponse] = await Promise.all([
      adminApi.listAssignments(filters),
      adminApi.listCohorts()
    ]);
    setAssignments(assignmentResponse.data);
    setCohorts(cohortResponse.data);
  }

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, [filters]);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  function startEdit(assignment) {
    setEditingId(assignment._id);
    setForm({
      title: assignment.title || "",
      instructions: assignment.instructions || "",
      cohort: assignment.cohort?._id || "",
      dueDate: toDateTimeInput(assignment.dueDate),
      maxScore: assignment.maxScore || 100,
      status: assignment.status || "draft",
      allowResubmission: Boolean(assignment.allowResubmission)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(assignment) {
    setError("");

    try {
      await adminApi.deleteAssignment(assignment._id);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const payload = { ...form, maxScore: Number(form.maxScore) };
      if (editingId) {
        await adminApi.updateAssignment(editingId, payload);
      } else {
        await adminApi.createAssignment(payload);
      }
      resetForm();
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Create assignments, attach templates, set deadlines, and monitor submissions."
        title="Assignments"
      />

      <FilterBar cohorts={cohorts} filters={filters} onChange={setFilters} onReset={() => setFilters({ search: "", cohort: "", status: "" })} statuses={statusOptions} />

      <Card>
        <form className="grid gap-4 lg:grid-cols-4" onSubmit={handleSubmit}>
          <FormField label="Title">
            <input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required value={form.title} />
          </FormField>
          <FormField label="Cohort">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, cohort: event.target.value }))} required value={form.cohort}>
              <option value="">Choose cohort</option>
              {cohorts.map((cohort) => <option key={cohort._id} value={cohort._id}>{cohort.title}</option>)}
            </select>
          </FormField>
          <FormField label="Due date">
            <input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} required type="datetime-local" value={form.dueDate} />
          </FormField>
          <FormField label="Max score">
            <input className={inputClassName} min="1" onChange={(event) => setForm((current) => ({ ...current, maxScore: event.target.value }))} type="number" value={form.maxScore} />
          </FormField>
          <div className="lg:col-span-4">
            <FormField label="Instructions">
              <textarea className={textAreaClassName} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} required value={form.instructions} />
            </FormField>
          </div>
          <FormField label="Status">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} value={form.status}>
              {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </FormField>
          <label className="flex items-center gap-2 pt-7 text-sm font-medium text-bybs-body">
            <input checked={form.allowResubmission} className="h-4 w-4 rounded border-bybs-border" onChange={(event) => setForm((current) => ({ ...current, allowResubmission: event.target.checked }))} type="checkbox" />
            Allow resubmission
          </label>
          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-4">{error}</p> : null}
          <div className="flex flex-wrap gap-2 lg:col-span-4">
            <Button disabled={isSubmitting} icon={editingId ? Save : Plus} type="submit">{isSubmitting ? "Saving..." : editingId ? "Update assignment" : "Create assignment"}</Button>
            {editingId ? <Button icon={X} onClick={resetForm} type="button" variant="secondary">Cancel edit</Button> : null}
          </div>
        </form>
      </Card>

      <DataTable
        columns={[
          { key: "title", header: "Assignment" },
          { key: "cohort", header: "Cohort", render: (row) => row.cohort?.title || "Unassigned" },
          { key: "dueDate", header: "Due date", render: (row) => new Date(row.dueDate).toLocaleString() },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <RowActions
                confirmMessage={`Delete ${row.title}? Assignments with submissions must be archived instead.`}
                onDelete={() => handleDelete(row)}
                onEdit={() => startEdit(row)}
              />
            )
          }
        ]}
        rows={assignments}
      />
    </div>
  );
}
