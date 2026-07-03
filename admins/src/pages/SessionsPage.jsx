import { Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, DataTable, PageHeader, StatusBadge } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { FilterBar } from "../components/FilterBar.jsx";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { RowActions } from "../components/RowActions.jsx";
import { adminApi } from "../services/api.js";
import { formatDateTime, relatedTitle } from "../utils/format.js";
import { canDeleteOperationalRecords } from "../utils/permissions.js";

const initialForm = {
  title: "",
  description: "",
  cohort: "",
  module: "",
  startsAt: "",
  endsAt: "",
  zoomLink: "",
  recordingLink: "",
  slidesUrl: "",
  status: "scheduled"
};

const statusOptions = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" }
];

function toDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function SessionsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [modules, setModules] = useState([]);
  const [filters, setFilters] = useState({ search: "", cohort: "", status: "" });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canDelete = canDeleteOperationalRecords(user);

  async function loadData() {
    const [sessionResponse, cohortResponse, moduleResponse] = await Promise.all([
      adminApi.listSessions(filters),
      adminApi.listCohorts(),
      adminApi.listModules()
    ]);
    setSessions(sessionResponse.data);
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

  function startEdit(session) {
    setEditingId(session._id);
    setForm({
      title: session.title || "",
      description: session.description || "",
      cohort: session.cohort?._id || "",
      module: session.module?._id || "",
      startsAt: toDateTimeInput(session.startsAt),
      endsAt: toDateTimeInput(session.endsAt),
      zoomLink: session.zoomLink || "",
      recordingLink: session.recordingLink || "",
      slidesUrl: session.slidesUrl || "",
      status: session.status || "scheduled"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(session) {
    setError("");

    try {
      await adminApi.deleteSession(session._id);
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
        await adminApi.updateSession(editingId, form);
      } else {
        await adminApi.createSession(form);
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
      <PageHeader description="Schedule cohort sessions and attach meeting, recording, and slides links." title="Sessions" />

      <FilterBar cohorts={cohorts} filters={filters} onChange={setFilters} onReset={() => setFilters({ search: "", cohort: "", status: "" })} statuses={statusOptions} />

      <Card>
        <form className="grid gap-4 lg:grid-cols-3" onSubmit={handleSubmit}>
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
          <FormField label="Starts at"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} required type="datetime-local" value={form.startsAt} /></FormField>
          <FormField label="Ends at"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} type="datetime-local" value={form.endsAt} /></FormField>
          <FormField label="Status">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} value={form.status}>
              {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </FormField>
          <FormField label="Zoom link"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, zoomLink: event.target.value }))} type="url" value={form.zoomLink} /></FormField>
          <FormField label="Recording link"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, recordingLink: event.target.value }))} type="url" value={form.recordingLink} /></FormField>
          <FormField label="Slides link"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, slidesUrl: event.target.value }))} type="url" value={form.slidesUrl} /></FormField>
          <div className="lg:col-span-3"><FormField label="Description"><textarea className={textAreaClassName} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} value={form.description} /></FormField></div>
          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-3">{error}</p> : null}
          <div className="flex flex-wrap gap-2 lg:col-span-3">
            <Button disabled={isSubmitting} icon={editingId ? Save : Plus} type="submit">{isSubmitting ? "Saving..." : editingId ? "Update session" : "Create session"}</Button>
            {editingId ? <Button icon={X} onClick={resetForm} type="button" variant="secondary">Cancel edit</Button> : null}
          </div>
        </form>
      </Card>

      <DataTable
        columns={[
          { key: "title", header: "Session" },
          { key: "cohort", header: "Cohort", render: (row) => relatedTitle(row.cohort) },
          { key: "module", header: "Module", render: (row) => relatedTitle(row.module) },
          { key: "startsAt", header: "Starts", render: (row) => formatDateTime(row.startsAt) },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <RowActions
                confirmMessage={`Delete ${row.title}? Sessions with resources or attendance must be cancelled instead.`}
                onDelete={canDelete ? () => handleDelete(row) : undefined}
                onEdit={() => startEdit(row)}
              />
            )
          }
        ]}
        rows={sessions}
      />
    </div>
  );
}
