import { Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, DataTable, PageHeader, RichTextEditor, StatusBadge } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { FilterBar } from "../components/FilterBar.jsx";
import { FormField, inputClassName } from "../components/FormField.jsx";
import { RowActions } from "../components/RowActions.jsx";
import { adminApi } from "../services/api.js";
import { formatDate, relatedTitle } from "../utils/format.js";
import { canDeleteOperationalRecords } from "../utils/permissions.js";

const initialForm = {
  title: "",
  description: "",
  cohort: "",
  assignedMentor: "",
  startDate: "",
  endDate: "",
  order: 0,
  status: "draft"
};

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" }
];

function toDateInput(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function ModulesPage() {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [filters, setFilters] = useState({ search: "", cohort: "", status: "" });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canDelete = canDeleteOperationalRecords(user);

  async function loadData() {
    const [moduleResponse, cohortResponse, mentorResponse] = await Promise.all([
      adminApi.listModules(filters),
      adminApi.listCohorts(),
      adminApi.listMentors()
    ]);
    setModules(moduleResponse.data);
    setCohorts(cohortResponse.data);
    setMentors(mentorResponse.data);
  }

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, [filters]);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  function startEdit(module) {
    setEditingId(module._id);
    setForm({
      title: module.title || "",
      description: module.description || "",
      cohort: module.cohort?._id || "",
      assignedMentor: module.assignedMentor?._id || module.assignedMentor?.id || "",
      startDate: toDateInput(module.startDate),
      endDate: toDateInput(module.endDate),
      order: module.order || 0,
      status: module.status || "draft"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(module) {
    setError("");

    try {
      await adminApi.deleteModule(module._id);
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
      const payload = { ...form, order: Number(form.order) };
      if (editingId) {
        await adminApi.updateModule(editingId, payload);
      } else {
        await adminApi.createModule(payload);
      }
      resetForm();
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredMentors = form.cohort
    ? mentors.filter((mentor) => (mentor.cohort?._id || mentor.cohort) === form.cohort)
    : mentors;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Create learning modules inside each cohort before adding sessions, resources, and assignments."
        title="Modules"
      />

      <FilterBar
        cohorts={cohorts}
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters({ search: "", cohort: "", status: "" })}
        statuses={statusOptions}
      />

      <Card>
        <form className="grid min-w-0 max-w-full gap-4 overflow-hidden lg:grid-cols-4" onSubmit={handleSubmit}>
          <FormField label="Title">
            <input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required value={form.title} />
          </FormField>
          <FormField label="Cohort">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, cohort: event.target.value, assignedMentor: "" }))} required value={form.cohort}>
              <option value="">Choose cohort</option>
              {cohorts.map((cohort) => <option key={cohort._id} value={cohort._id}>{cohort.title}</option>)}
            </select>
          </FormField>
          <FormField label="Assigned mentor">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, assignedMentor: event.target.value }))} value={form.assignedMentor}>
              <option value="">Unassigned</option>
              {filteredMentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}
            </select>
          </FormField>
          <FormField label="Order">
            <input className={inputClassName} min="0" onChange={(event) => setForm((current) => ({ ...current, order: event.target.value }))} type="number" value={form.order} />
          </FormField>
          <FormField label="Start date">
            <input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} type="date" value={form.startDate} />
          </FormField>
          <FormField label="End date">
            <input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} type="date" value={form.endDate} />
          </FormField>
          <FormField label="Status">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} value={form.status}>
              {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </FormField>
          <div className="min-w-0 lg:col-span-4">
            <label className="text-sm font-medium text-bybs-body" htmlFor="module-description">
              Description
            </label>
            <p className="mb-2 mt-1 text-xs text-bybs-muted">
              Add the module outline, key topics, learning outcomes, resources, and what the mentor should cover.
            </p>
            <RichTextEditor
              id="module-description"
              onChange={(value) => setForm((current) => ({ ...current, description: value }))}
              placeholder="Describe what this module entails"
              value={form.description}
            />
          </div>
          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-4">{error}</p> : null}
          <div className="flex min-w-0 flex-wrap gap-2 lg:col-span-4">
            <Button disabled={isSubmitting} icon={editingId ? Save : Plus} type="submit">
              {isSubmitting ? "Saving..." : editingId ? "Update module" : "Create module"}
            </Button>
            {editingId ? <Button icon={X} onClick={resetForm} type="button" variant="secondary">Cancel edit</Button> : null}
          </div>
        </form>
      </Card>

      <DataTable
        columns={[
          { key: "title", header: "Module" },
          { key: "cohort", header: "Cohort", render: (row) => relatedTitle(row.cohort) },
          { key: "assignedMentor", header: "Mentor", render: (row) => relatedTitle(row.assignedMentor) },
          { key: "dates", header: "Dates", render: (row) => row.startDate || row.endDate ? `${formatDate(row.startDate)} - ${formatDate(row.endDate)}` : "Not set" },
          { key: "order", header: "Order" },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <RowActions
                confirmMessage={`Delete ${row.title}? This is only allowed when it has no linked content.`}
                onDelete={canDelete ? () => handleDelete(row) : undefined}
                onEdit={() => startEdit(row)}
              />
            )
          }
        ]}
        rows={modules}
      />
    </div>
  );
}
