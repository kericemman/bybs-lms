import { CalendarCheck, ClipboardCheck, Copy, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, DataTable, EmptyState, PageHeader, SectionHeader, StatusBadge } from "@bybs/shared";
import { FormField, inputClassName } from "../components/FormField.jsx";
import { mentorApi } from "../services/api.js";
import { formatCatDateTime } from "../utils/format.js";

const attendanceOptions = [
  { value: "", label: "Choose status" },
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" }
];

function idFor(value) {
  return String(value?._id || value?.id || value || "");
}

function sessionLabel(session) {
  if (!session) return "Choose session";
  return `${session.title || "Session"} - ${formatCatDateTime(session.startsAt)}`;
}

function attendanceLink(sessionId) {
  if (!sessionId || typeof window === "undefined") return "";
  return `${window.location.origin}/attendance?session=${sessionId}`;
}

export function AttendancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(searchParams.get("session") || "");
  const [attendance, setAttendance] = useState(null);
  const [records, setRecords] = useState({});
  const [markCompleted, setMarkCompleted] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedSession = useMemo(
    () => attendance?.session || sessions.find((session) => idFor(session) === selectedSessionId),
    [attendance, selectedSessionId, sessions]
  );
  const roster = attendance?.roster || [];
  const pendingCount = roster.filter((row) => !records[idFor(row.student)]).length;

  useEffect(() => {
    let isMounted = true;

    mentorApi
      .listSessions()
      .then((response) => {
        if (!isMounted) return;
        setSessions(response.data || []);
        if (!selectedSessionId && response.data?.[0]?._id) {
          const firstSessionId = response.data[0]._id;
          setSelectedSessionId(firstSessionId);
          setSearchParams({ session: firstSessionId });
        }
      })
      .catch((requestError) => {
        if (isMounted) setError(requestError.message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSessions(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedSessionId) {
      setAttendance(null);
      setRecords({});
      return;
    }

    let isMounted = true;
    setIsLoadingAttendance(true);
    setError("");
    setFeedback("");

    mentorApi
      .getSessionAttendance(selectedSessionId)
      .then((response) => {
        if (!isMounted) return;
        setAttendance(response.data);
        setRecords(
          Object.fromEntries(
            (response.data?.roster || []).map((row) => [idFor(row.student), row.status || ""])
          )
        );
      })
      .catch((requestError) => {
        if (isMounted) setError(requestError.message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingAttendance(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSessionId]);

  function updateSession(sessionId) {
    setSelectedSessionId(sessionId);
    setAttendance(null);
    setRecords({});
    setSearchParams(sessionId ? { session: sessionId } : {});
  }

  function updateAttendance(studentId, status) {
    setRecords((current) => ({ ...current, [studentId]: status }));
  }

  async function copyAttendanceLink() {
    const link = attendanceLink(selectedSessionId);
    if (!link) return;

    try {
      await window.navigator.clipboard.writeText(link);
      setFeedback("Attendance link copied.");
      setError("");
    } catch {
      setFeedback(link);
    }
  }

  async function saveAttendance(event) {
    event.preventDefault();
    setError("");
    setFeedback("");

    if (!roster.length) {
      setError("No mentees are available for this session cohort.");
      return;
    }

    if (pendingCount > 0) {
      setError("Choose an attendance status for every mentee before saving.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await mentorApi.updateSessionAttendance(selectedSessionId, {
        markCompleted,
        records: roster.map((row) => ({
          student: idFor(row.student),
          status: records[idFor(row.student)]
        }))
      });

      setAttendance(response.data);
      setFeedback("Attendance saved.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button disabled={!selectedSessionId} icon={Copy} onClick={copyAttendanceLink} type="button" variant="secondary">
            Copy attendance link
          </Button>
        }
        description="Open a session attendance link, mark each mentee, and keep attendance visible in progress tracking."
        title="Attendance"
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <FormField label="Session" hint="Use this as the attendance link after a BYBS session.">
            <select className={inputClassName} disabled={isLoadingSessions} onChange={(event) => updateSession(event.target.value)} value={selectedSessionId}>
              <option value="">Choose session</option>
              {sessions.map((session) => (
                <option key={session._id} value={session._id}>
                  {sessionLabel(session)}
                </option>
              ))}
            </select>
          </FormField>
          <Button disabled={!selectedSessionId} icon={Copy} onClick={copyAttendanceLink} type="button" variant="secondary">
            Copy link
          </Button>
        </div>
      </Card>

      {selectedSession ? (
        <Card>
          <SectionHeader
            description={`${selectedSession.module?.title || "Module"} · ${selectedSession.cohort?.title || "Cohort"} · ${formatCatDateTime(selectedSession.startsAt)}`}
            title={selectedSession.title || "Session attendance"}
          />
          <div className="grid gap-3 sm:grid-cols-5">
            {[
              ["Marked", attendance?.session?.attendanceSummary?.marked || 0],
              ["Present", attendance?.session?.attendanceSummary?.present || 0],
              ["Late", attendance?.session?.attendanceSummary?.late || 0],
              ["Absent", attendance?.session?.attendanceSummary?.absent || 0],
              ["Pending", pendingCount]
            ].map(([label, value]) => (
              <div className="rounded-md border border-bybs-border bg-white px-3 py-2" key={label}>
                <p className="text-xs font-medium text-bybs-muted">{label}</p>
                <p className="mt-1 text-lg font-semibold text-bybs-navy">{value}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {isLoadingAttendance ? (
        <div className="rounded-lg border border-bybs-border bg-white p-8 text-center text-sm text-bybs-muted">
          Loading attendance roster...
        </div>
      ) : selectedSessionId ? (
        <form className="space-y-4" onSubmit={saveAttendance}>
          <DataTable
            columns={[
              { key: "student", header: "Mentee", render: (row) => row.student?.name || "Mentee" },
              { key: "email", header: "Email", render: (row) => row.student?.email || "Not set" },
              {
                key: "status",
                header: "Attendance",
                render: (row) => (
                  <select
                    className={inputClassName}
                    onChange={(event) => updateAttendance(idFor(row.student), event.target.value)}
                    value={records[idFor(row.student)] || ""}
                  >
                    {attendanceOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                )
              },
              {
                key: "savedStatus",
                header: "Saved",
                render: (row) => row.status ? <StatusBadge status={row.status} /> : <StatusBadge label="Not marked" status="pending" />
              }
            ]}
            emptyDescription="Mentees assigned to this session cohort will appear here."
            emptyTitle="No mentees for this session"
            rows={roster}
          />

          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-bybs-body">
                <input
                  checked={markCompleted}
                  className="h-4 w-4 rounded border-bybs-border text-bybs-blue focus:ring-bybs-pale"
                  onChange={(event) => setMarkCompleted(event.target.checked)}
                  type="checkbox"
                />
                Mark session as completed after saving attendance
              </label>
              <Button disabled={isSaving || !roster.length} icon={Save} type="submit">
                {isSaving ? "Saving..." : "Save attendance"}
              </Button>
            </div>
          </Card>
        </form>
      ) : (
        <EmptyState
          description="Choose a session above to open the attendance roster."
          icon={CalendarCheck}
          title="Choose a session"
        />
      )}

      <Card>
        <SectionHeader
          description="Open attendance directly from any session. These are your sessions from assigned cohorts and modules."
          title="Session attendance links"
        />
        <DataTable
          columns={[
            { key: "title", header: "Session" },
            { key: "module", header: "Module", render: (row) => row.module?.title || "Unassigned" },
            { key: "startsAt", header: "Date", render: (row) => formatCatDateTime(row.startsAt) },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
            { key: "marked", header: "Marked", render: (row) => row.attendanceSummary?.marked || row.attendance?.length || 0 },
            {
              key: "actions",
              header: "Actions",
              render: (row) => (
                <Button icon={ClipboardCheck} onClick={() => updateSession(row._id)} size="sm" type="button" variant="secondary">
                  Open
                </Button>
              )
            }
          ]}
          emptyDescription="Admin scheduled sessions will appear here."
          emptyTitle="No sessions available"
          rows={sessions}
        />
      </Card>
    </div>
  );
}
