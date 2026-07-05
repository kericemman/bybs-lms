import { Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, DataTable, PageHeader, StatusBadge } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { FilterBar } from "../components/FilterBar.jsx";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { RowActions } from "../components/RowActions.jsx";
import { adminApi } from "../services/api.js";
import { relatedTitle } from "../utils/format.js";
import { canDeleteOperationalRecords } from "../utils/permissions.js";

const catTimeZone = "Africa/Maputo";

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

function toCatDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: catTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function catSessionIso(dateValue, hour) {
  const [year, month, day] = dateValue.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day, hour - 2, 0, 0, 0)).toISOString();
}

function isWeekendDate(dateValue) {
  if (!dateValue) return false;
  const day = new Date(`${dateValue}T12:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

function formatCatDateTime(value) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: catTimeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value)) + " CAT";
}

function mentorName(module) {
  return module?.assignedMentor?.name || module?.assignedMentor?.email || "No mentor assigned";
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
  const [feedback, setFeedback] = useState("");
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
      startsAt: toCatDateInput(session.startsAt),
      endsAt: toCatDateInput(session.endsAt),
      zoomLink: session.zoomLink || "",
      recordingLink: session.recordingLink || "",
      slidesUrl: session.slidesUrl || "",
      status: session.status || "scheduled"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(session) {
    setError("");
    setFeedback("");

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
    setFeedback("");
    setIsSubmitting(true);

    try {
      const payload = {
        ...form,
        startsAt: catSessionIso(form.startsAt, 14),
        endsAt: catSessionIso(form.startsAt, 16)
      };

      if (editingId) {
        await adminApi.updateSession(editingId, payload);
      } else {
        await adminApi.createSession(payload);
      }
      resetForm();
      setFeedback(editingId ? "Session updated." : "Session created.");
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function generateWeekendSessions() {
    if (!selectedModule) return;

    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      const response = await adminApi.generateModuleWeekendSessions(selectedModule._id);
      setFeedback(`${response.meta?.created || 0} weekend session(s) created for ${selectedModule.title}. ${response.meta?.existing || 0} already existed.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredModules = form.cohort ? modules.filter((module) => module.cohort?._id === form.cohort) : modules;
  const selectedModule = modules.find((module) => module._id === form.module);
  const sessionDateError = form.startsAt && !isWeekendDate(form.startsAt) ? "Choose a Saturday or Sunday. BYBS sessions run on weekends." : "";

  function chooseCohort(cohortId) {
    setForm((current) => ({ ...current, cohort: cohortId, module: "" }));
  }

  function chooseModule(moduleId) {
    const module = modules.find((item) => item._id === moduleId);
    setForm((current) => ({
      ...current,
      module: moduleId,
      cohort: module?.cohort?._id || current.cohort,
      title: current.title || (module ? `${module.title} session` : "")
    }));
  }

  return (
    <div className="space-y-6">
      <PageHeader description="Schedule cohort sessions and attach meeting, recording, and slides links." title="Sessions" />

      <FilterBar cohorts={cohorts} filters={filters} onChange={setFilters} onReset={() => setFilters({ search: "", cohort: "", status: "" })} statuses={statusOptions} />

      <Card>
        <form className="grid gap-4 lg:grid-cols-3" onSubmit={handleSubmit}>
          <FormField label="Title"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required value={form.title} /></FormField>
          <FormField label="Cohort">
            <select className={inputClassName} onChange={(event) => chooseCohort(event.target.value)} required value={form.cohort}>
              <option value="">Choose cohort</option>
              {cohorts.map((cohort) => <option key={cohort._id} value={cohort._id}>{cohort.title}</option>)}
            </select>
          </FormField>
          <FormField label="Module">
            <select className={inputClassName} onChange={(event) => chooseModule(event.target.value)} required value={form.module}>
              <option value="">Choose module</option>
              {filteredModules.map((module) => <option key={module._id} value={module._id}>{module.title}</option>)}
            </select>
          </FormField>
          <FormField hint="Sessions are fixed at 2:00 PM - 4:00 PM CAT." label="Session date">
            <input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value, endsAt: event.target.value }))} required type="date" value={form.startsAt} />
          </FormField>
          <div className="rounded-md border border-bybs-border bg-bybs-pale p-3 text-sm text-bybs-body">
            <p className="font-medium text-bybs-navy">Assigned mentor</p>
            <p className="mt-1">{mentorName(selectedModule)}</p>
            <p className="mt-2 text-xs text-bybs-muted">Based on the selected module.</p>
            {selectedModule ? (
              <Button className="mt-3" disabled={isSubmitting || !selectedModule.startDate || !selectedModule.endDate} onClick={generateWeekendSessions} size="sm" type="button" variant="secondary">
                Generate weekend sessions
              </Button>
            ) : null}
          </div>
          <FormField label="Status">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} value={form.status}>
              {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </FormField>
          <FormField label="Zoom link"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, zoomLink: event.target.value }))} type="url" value={form.zoomLink} /></FormField>
          <FormField label="Recording link"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, recordingLink: event.target.value }))} type="url" value={form.recordingLink} /></FormField>
          <FormField label="Slides link"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, slidesUrl: event.target.value }))} type="url" value={form.slidesUrl} /></FormField>
          <div className="lg:col-span-3"><FormField label="Description"><textarea className={textAreaClassName} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} value={form.description} /></FormField></div>
          {sessionDateError ? <p className="rounded-md bg-bybs-gold/30 px-3 py-2 text-sm text-bybs-navy lg:col-span-3">{sessionDateError}</p> : null}
          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-3">{error}</p> : null}
          {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue lg:col-span-3">{feedback}</p> : null}
          <div className="flex flex-wrap gap-2 lg:col-span-3">
            <Button disabled={isSubmitting || Boolean(sessionDateError)} icon={editingId ? Save : Plus} type="submit">{isSubmitting ? "Saving..." : editingId ? "Update session" : "Create session"}</Button>
            {editingId ? <Button icon={X} onClick={resetForm} type="button" variant="secondary">Cancel edit</Button> : null}
          </div>
        </form>
      </Card>

      <DataTable
        columns={[
          { key: "title", header: "Session" },
          { key: "cohort", header: "Cohort", render: (row) => relatedTitle(row.cohort) },
          { key: "module", header: "Module", render: (row) => relatedTitle(row.module) },
          { key: "mentor", header: "Mentor", render: (row) => mentorName(row.module) },
          { key: "startsAt", header: "Starts", render: (row) => formatCatDateTime(row.startsAt) },
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
