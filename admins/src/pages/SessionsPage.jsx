import { ClipboardCheck, Plus, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card, DataTable, PageHeader, SectionHeader, StatusBadge } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { FilterBar } from "../components/FilterBar.jsx";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { RowActions } from "../components/RowActions.jsx";
import { adminApi } from "../services/api.js";
import { formatDateTime, relatedTitle } from "../utils/format.js";
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

const attendanceOptions = [
  { value: "notMarked", label: "Not marked" },
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" }
];

function idFor(value) {
  return String(value?._id || value?.id || value || "");
}

function attendanceBadge(status) {
  if (status === "notMarked") return <StatusBadge label="Not marked" status="pending" />;
  return <StatusBadge status={status} />;
}

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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attendance, setAttendance] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [attendanceReason, setAttendanceReason] = useState("");
  const [attendanceMarkCompleted, setAttendanceMarkCompleted] = useState(false);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const attendancePanelRef = useRef(null);
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
    setIsFormOpen(false);
  }

  function startEdit(session) {
    setAttendance(null);
    setEditingId(session._id);
    setIsFormOpen(true);
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

  async function openAttendance(session) {
    setIsFormOpen(false);
    setAttendance(null);
    setAttendanceRecords({});
    setAttendanceReason("");
    setAttendanceMarkCompleted(session.status === "completed");
    setError("");
    setFeedback("");
    setIsLoadingAttendance(true);

    requestAnimationFrame(() => attendancePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

    try {
      const response = await adminApi.getSessionAttendance(session._id);
      setAttendance(response.data);
      setAttendanceRecords(Object.fromEntries(
        (response.data?.roster || []).map((row) => [idFor(row.student), row.status || "notMarked"])
      ));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoadingAttendance(false);
    }
  }

  function closeAttendance() {
    setAttendance(null);
    setAttendanceRecords({});
    setAttendanceReason("");
    setAttendanceMarkCompleted(false);
  }

  async function saveAttendance(event) {
    event.preventDefault();
    const roster = attendance?.roster || [];
    const changedRecords = roster
      .filter((row) => (attendanceRecords[idFor(row.student)] || "notMarked") !== row.status)
      .map((row) => ({
        student: idFor(row.student),
        status: attendanceRecords[idFor(row.student)] || "notMarked"
      }));

    if (attendanceReason.trim().length < 5) {
      setError("Add a brief reason for this attendance update.");
      return;
    }

    if (!changedRecords.length) {
      setError("Change at least one attendance status before saving.");
      return;
    }

    setError("");
    setFeedback("");
    setIsSavingAttendance(true);

    try {
      const response = await adminApi.updateSessionAttendance(attendance.session._id, {
        markCompleted: attendanceMarkCompleted,
        reason: attendanceReason.trim(),
        expectedUpdatedAt: attendance.session.updatedAt,
        records: changedRecords
      });
      setAttendance(response.data);
      setAttendanceRecords(Object.fromEntries(
        (response.data?.roster || []).map((row) => [idFor(row.student), row.status || "notMarked"])
      ));
      setAttendanceReason("");
      setFeedback(response.meta?.changedCount
        ? `${response.meta.changedCount} attendance record(s) updated.`
        : "Attendance was already up to date.");
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSavingAttendance(false);
    }
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
      <PageHeader
        actions={
          <Button icon={isFormOpen ? X : Plus} onClick={() => (isFormOpen ? resetForm() : setIsFormOpen(true))} type="button" variant={isFormOpen ? "secondary" : "primary"}>
            {isFormOpen ? "Close form" : "Create session"}
          </Button>
        }
        description="Schedule cohort sessions and attach meeting, recording, and slides links."
        title="Sessions"
      />

      <FilterBar cohorts={cohorts} filters={filters} onChange={setFilters} onReset={() => setFilters({ search: "", cohort: "", status: "" })} statuses={statusOptions} />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      <div ref={attendancePanelRef} />

      {isLoadingAttendance ? (
        <Card>
          <p className="py-6 text-center text-sm text-bybs-muted">Loading attendance roster...</p>
        </Card>
      ) : attendance ? (
        <form className="space-y-4" onSubmit={saveAttendance}>
          <Card>
            <SectionHeader
              action={<Button icon={X} onClick={closeAttendance} size="sm" type="button" variant="secondary">Close</Button>}
              description={`${relatedTitle(attendance.session.module, "Module")} · ${relatedTitle(attendance.session.cohort, "Cohort")} · ${formatCatDateTime(attendance.session.startsAt)}`}
              title={`${attendance.session.title} attendance`}
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              {[
                ["Total", attendance.session.attendanceSummary?.total || 0],
                ["Marked", attendance.session.attendanceSummary?.marked || 0],
                ["Present", attendance.session.attendanceSummary?.present || 0],
                ["Late", attendance.session.attendanceSummary?.late || 0],
                ["Absent", attendance.session.attendanceSummary?.absent || 0],
                ["Not marked", attendance.session.attendanceSummary?.pending || 0]
              ].map(([label, value]) => (
                <div className="min-w-0 rounded-md border border-bybs-border bg-white p-3" key={label}>
                  <p className="break-words text-xs font-medium text-bybs-muted">{label}</p>
                  <p className="mt-1 text-xl font-semibold text-bybs-navy">{value}</p>
                </div>
              ))}
            </div>
          </Card>

          <DataTable
            columns={[
              { key: "student", header: "Mentee", render: (row) => row.student?.name || "Mentee" },
              { key: "email", header: "Email", render: (row) => row.student?.email || "Not set" },
              {
                key: "status",
                header: "Attendance",
                render: (row) => (
                  <select
                    aria-label={`Attendance for ${row.student?.name || row.student?.email || "mentee"}`}
                    className={inputClassName}
                    onChange={(event) => setAttendanceRecords((current) => ({
                      ...current,
                      [idFor(row.student)]: event.target.value
                    }))}
                    value={attendanceRecords[idFor(row.student)] || "notMarked"}
                  >
                    {attendanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                )
              },
              { key: "saved", header: "Saved status", render: (row) => attendanceBadge(row.status) },
              {
                key: "updated",
                header: "Last updated",
                render: (row) => row.markedAt
                  ? `${row.markedBy?.name || "BYBS team"} · ${formatDateTime(row.markedAt)}`
                  : "Not marked"
              }
            ]}
            emptyDescription="Active mentees assigned to this cohort will appear here."
            emptyTitle="No mentees in this cohort"
            label={`${attendance.session.title} attendance roster`}
            rows={attendance.roster || []}
          />

          <Card>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <FormField hint="This is stored in the correction history." label="Reason for attendance update">
                <textarea
                  className={textAreaClassName}
                  maxLength={500}
                  onChange={(event) => setAttendanceReason(event.target.value)}
                  placeholder="Example: Corrected from the signed attendance sheet."
                  required
                  value={attendanceReason}
                />
              </FormField>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="inline-flex items-center gap-2 text-sm text-bybs-body">
                  <input
                    checked={attendanceMarkCompleted}
                    className="h-4 w-4 rounded border-bybs-border text-bybs-blue focus:ring-bybs-pale"
                    onChange={(event) => setAttendanceMarkCompleted(event.target.checked)}
                    type="checkbox"
                  />
                  Mark session completed
                </label>
                <Button disabled={isSavingAttendance || !(attendance.roster || []).length} icon={Save} type="submit">
                  {isSavingAttendance ? "Saving..." : "Save attendance"}
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader
              description="The latest 100 changes are shown with the person and reason responsible."
              title="Correction history"
            />
            <DataTable
              columns={[
                { key: "student", header: "Mentee", render: (row) => row.student?.name || row.student?.email || "Mentee" },
                { key: "change", header: "Change", render: (row) => `${attendanceOptions.find((option) => option.value === row.previousStatus)?.label || row.previousStatus} to ${attendanceOptions.find((option) => option.value === row.newStatus)?.label || row.newStatus}` },
                { key: "changedBy", header: "Changed by", render: (row) => row.changedBy?.name || row.changedBy?.email || row.sourceRole || "System" },
                { key: "changedAt", header: "Date", render: (row) => formatDateTime(row.changedAt) },
                { key: "reason", header: "Reason", wrap: true, render: (row) => row.reason || "No reason recorded" }
              ]}
              emptyDescription="Attendance changes will appear after the first saved update."
              emptyTitle="No corrections recorded"
              rows={attendance.audit || []}
            />
          </Card>
        </form>
      ) : null}

      {isFormOpen ? (
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
          <div className="flex flex-wrap gap-2 lg:col-span-3">
            <Button disabled={isSubmitting || Boolean(sessionDateError)} icon={editingId ? Save : Plus} type="submit">{isSubmitting ? "Saving..." : editingId ? "Update session" : "Create session"}</Button>
            {editingId ? <Button icon={X} onClick={resetForm} type="button" variant="secondary">Cancel edit</Button> : null}
          </div>
        </form>
      </Card>
      ) : null}

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
              <div className="flex items-center gap-2">
                <Button icon={ClipboardCheck} onClick={() => openAttendance(row)} size="sm" type="button" variant="secondary">
                  Attendance
                </Button>
                <RowActions
                  confirmMessage={`Delete ${row.title}? Sessions with resources or attendance must be cancelled instead.`}
                  onDelete={canDelete ? () => handleDelete(row) : undefined}
                  onEdit={() => startEdit(row)}
                />
              </div>
            )
          }
        ]}
        rows={sessions}
      />
    </div>
  );
}
