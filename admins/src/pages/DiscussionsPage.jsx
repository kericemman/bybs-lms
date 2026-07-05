import { Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, DataTable, DISCUSSION_AUDIENCE_OPTIONS, PageHeader, StatusBadge } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { FilterBar } from "../components/FilterBar.jsx";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { RowActions } from "../components/RowActions.jsx";
import { adminApi } from "../services/api.js";
import { relatedTitle } from "../utils/format.js";
import { canDeleteOperationalRecords } from "../utils/permissions.js";

const initialForm = {
  title: "",
  body: "",
  cohort: "",
  module: "",
  audience: "all",
  status: "open"
};

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" }
];

function audienceLabel(value = "all") {
  return DISCUSSION_AUDIENCE_OPTIONS.find((option) => option.value === value)?.label || "Everyone";
}

export function DiscussionsPage() {
  const { user } = useAuth();
  const [discussions, setDiscussions] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [modules, setModules] = useState([]);
  const [filters, setFilters] = useState({ search: "", cohort: "", status: "" });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canDelete = canDeleteOperationalRecords(user);

  async function loadData() {
    const [discussionResponse, cohortResponse, moduleResponse] = await Promise.all([
      adminApi.listDiscussions(filters),
      adminApi.listCohorts(),
      adminApi.listModules()
    ]);
    setDiscussions(discussionResponse.data);
    setCohorts(cohortResponse.data);
    setModules(moduleResponse.data);
  }

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, [filters]);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  function startEdit(discussion) {
    setEditingId(discussion._id);
    setForm({
      title: discussion.title || "",
      body: discussion.body || "",
      cohort: discussion.cohort?._id || "",
      module: discussion.module?._id || "",
      audience: discussion.audience || "all",
      status: discussion.status || "open"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(discussion) {
    setError("");

    try {
      await adminApi.deleteDiscussion(discussion._id);
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
      if (editingId) {
        await adminApi.updateDiscussion(editingId, form);
      } else {
        await adminApi.createDiscussion(form);
      }
      resetForm();
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredModules = form.cohort ? modules.filter((module) => module.cohort?._id === form.cohort) : modules;

  return (
    <div className="space-y-6">
      <PageHeader description="Create and moderate structured cohort/module discussion threads." title="Discussions" />

      <FilterBar cohorts={cohorts} filters={filters} onChange={setFilters} onReset={() => setFilters({ search: "", cohort: "", status: "" })} statuses={statusOptions} />

      <Card>
        <form className="grid gap-4 lg:grid-cols-4" onSubmit={handleSubmit}>
          <FormField label="Title"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required value={form.title} /></FormField>
          <FormField label="Cohort">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, cohort: event.target.value, module: "" }))} required value={form.cohort}>
              <option value="">Choose cohort</option>
              {cohorts.map((cohort) => <option key={cohort._id} value={cohort._id}>{cohort.title}</option>)}
            </select>
          </FormField>
          <FormField label="Module">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, module: event.target.value }))} value={form.module}>
              <option value="">No module</option>
              {filteredModules.map((module) => <option key={module._id} value={module._id}>{module.title}</option>)}
            </select>
          </FormField>
          <FormField label="Status">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} value={form.status}>
              {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </FormField>
          <FormField label="Who can see this?">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))} value={form.audience}>
              {DISCUSSION_AUDIENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </FormField>
          <div className="lg:col-span-4"><FormField label="Prompt"><textarea className={textAreaClassName} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} value={form.body} /></FormField></div>
          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-4">{error}</p> : null}
          <div className="flex flex-wrap gap-2 lg:col-span-4">
            <Button disabled={isSubmitting} icon={editingId ? Save : Plus} type="submit">{isSubmitting ? "Saving..." : editingId ? "Update discussion" : "Create discussion"}</Button>
            {editingId ? <Button icon={X} onClick={resetForm} type="button" variant="secondary">Cancel edit</Button> : null}
          </div>
        </form>
      </Card>

      <DataTable
        columns={[
          { key: "title", header: "Discussion" },
          { key: "cohort", header: "Cohort", render: (row) => relatedTitle(row.cohort) },
          { key: "module", header: "Module", render: (row) => relatedTitle(row.module) },
          { key: "audience", header: "Audience", render: (row) => audienceLabel(row.audience) },
          { key: "comments", header: "Comments", render: (row) => row.comments?.length || 0 },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <RowActions
                confirmMessage={`Delete ${row.title}? Discussions with comments must be archived instead.`}
                onDelete={canDelete ? () => handleDelete(row) : undefined}
                onEdit={() => startEdit(row)}
              />
            )
          }
        ]}
        rows={discussions}
      />
    </div>
  );
}
