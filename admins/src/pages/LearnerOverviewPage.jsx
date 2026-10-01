import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  GraduationCap,
  Search,
  ShieldCheck,
  X
} from "lucide-react";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  ProgressBar,
  StatCard,
  StatusBadge,
  useDialogAccessibility
} from "@bybs/shared";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { adminApi } from "../services/api.js";

const inputClassName = "h-11 w-full rounded-md border border-bybs-border bg-white px-3 text-base text-bybs-text outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale sm:text-sm";
const initialFilters = { search: "", status: "", risk: "", readiness: "" };

function idFor(value) {
  return String(value?._id || value?.id || value || "");
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat(undefined, includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
}

function LearnerAvatar({ learner, large = false }) {
  const dimension = large ? "h-14 w-14 text-base" : "h-10 w-10 text-sm";
  const initials = String(learner?.name || "M")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  if (learner?.profileImage) {
    return <img alt={`${learner.name || "Mentee"} profile`} className={`${dimension} shrink-0 rounded-full object-cover`} src={learner.profileImage} />;
  }

  return (
    <span aria-hidden="true" className={`${dimension} inline-flex shrink-0 items-center justify-center rounded-full bg-bybs-pale font-semibold text-bybs-blue`}>
      {initials || "M"}
    </span>
  );
}

function LearnerIdentity({ row }) {
  return (
    <div className="flex min-w-56 items-center gap-3">
      <LearnerAvatar learner={row.student} />
      <div className="min-w-0">
        <p className="truncate font-medium text-bybs-navy">{row.student?.name || "Mentee"}</p>
        <p className="truncate text-xs text-bybs-muted">{row.student?.email || "No email"}</p>
        <p className="truncate text-xs text-bybs-muted">{row.student?.mentor?.name || "No primary mentor"}</p>
      </div>
    </div>
  );
}

function RiskBadge({ risk }) {
  const labels = { onTrack: "On track", watch: "Watch", needsAttention: "Needs attention" };
  const tones = { onTrack: "success", watch: "warning", needsAttention: "danger" };
  return <StatusBadge label={labels[risk] || "Not assessed"} status={risk} tone={tones[risk] || "neutral"} />;
}

function Metric({ label, value, hint }) {
  return (
    <div className="min-w-0 rounded-md border border-bybs-border bg-white p-3">
      <p className="text-xs font-medium uppercase text-bybs-muted">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold text-bybs-navy">{value}</p>
      {hint ? <p className="mt-1 text-xs text-bybs-muted">{hint}</p> : null}
    </div>
  );
}

function DetailSection({ title, description, children }) {
  return (
    <section className="border-t border-bybs-border pt-5">
      <h3 className="text-base font-semibold text-bybs-navy">{title}</h3>
      {description ? <p className="mt-1 text-sm text-bybs-body">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DetailDialog({ learnerId, detail, error, isLoading, onClose, onNavigate }) {
  const dialogRef = useDialogAccessibility({ isOpen: Boolean(learnerId), onClose });
  if (!learnerId) return null;

  const student = detail?.student;
  const progress = detail?.progress;
  const attendanceHistory = progress?.attendanceHistory?.slice(0, 6) || [];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bybs-navy/50 p-3 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-labelledby="learner-overview-dialog-title"
        aria-modal="true"
        className="mx-auto my-3 w-full max-w-5xl overflow-hidden rounded-lg bg-bybs-page shadow-xl sm:my-8"
        ref={dialogRef}
        role="dialog"
        tabIndex="-1"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-bybs-border bg-white p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-bybs-blue">Learner overview</p>
            <h2 className="mt-1 break-words text-xl font-semibold text-bybs-navy" id="learner-overview-dialog-title">
              {student?.name || "Mentee details"}
            </h2>
          </div>
          <Button aria-label="Close learner overview" icon={X} onClick={onClose} size="icon" type="button" variant="secondary" />
        </div>

        <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="space-y-4" role="status">
              <div className="h-24 animate-pulse rounded-md bg-bybs-pale" />
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((item) => <div className="h-24 animate-pulse rounded-md bg-bybs-pale" key={item} />)}
              </div>
              <span className="sr-only">Loading learner details...</span>
            </div>
          ) : error ? (
            <p className="rounded-md bg-bybs-blush px-4 py-3 text-sm text-bybs-rose" role="alert">{error}</p>
          ) : detail ? (
            <div className="space-y-5">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <LearnerAvatar large learner={student} />
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-bybs-navy">{student?.name}</p>
                    <p className="break-all text-sm text-bybs-body">{student?.email}</p>
                    <p className="mt-1 text-xs text-bybs-muted">{student?.cohort?.title || "No cohort"} · {student?.mentor?.name || "No primary mentor"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={student?.status} />
                  <RiskBadge risk={detail.risk} />
                  <StatusBadge label={progress?.graduationReady ? "Graduation ready" : "Not graduation ready"} status={progress?.graduationReady ? "approved" : "pending"} />
                </div>
              </div>

              {detail.attentionReasons?.length ? (
                <div className="rounded-md bg-bybs-gold/30 p-4">
                  <p className="font-medium text-bybs-navy">Items to review</p>
                  <ul className="mt-2 space-y-1 text-sm text-bybs-body">
                    {detail.attentionReasons.map((reason) => <li key={reason}>- {reason}</li>)}
                  </ul>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md bg-bybs-pale p-4 text-sm text-bybs-blue">
                  <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                  No objective progress flags need admin attention right now.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric label="Overall" value={`${progress?.progress || 0}%`} hint="Computed score" />
                <Metric label="Assignments" value={`${progress?.submittedCount || 0}/${progress?.totalAssignments || 0}`} hint={`${progress?.pendingCount || 0} pending`} />
                <Metric label="Approved score" value={`${progress?.scorePercentage || 0}%`} hint={`${progress?.scoredCount || 0} scored`} />
                <Metric label="Attendance" value={`${progress?.attendancePercentage || 0}%`} hint={`${progress?.attendanceMarked || 0}/${progress?.sessionsHeld || 0} marked`} />
              </div>

              <DetailSection description="Computed from platform records; mentor narrative comments do not change this score." title="Progress evidence">
                <div className="grid gap-4 md:grid-cols-2">
                  <ProgressBar label="Assignment completion" value={progress?.assignmentCompletionPercentage || 0} />
                  <ProgressBar label="Approved score" value={progress?.scorePercentage || 0} />
                  <ProgressBar label="Attendance" value={progress?.attendancePercentage || 0} />
                  <ProgressBar label="Punctuality" value={progress?.punctualityPercentage || 0} />
                </div>
              </DetailSection>

              <DetailSection description="The most recently updated work in the learner's current cohort." title="Assignment activity">
                {!detail.recentSubmissions?.length ? (
                  <p className="text-sm text-bybs-muted">No submissions recorded for this cohort.</p>
                ) : (
                  <div className="divide-y divide-bybs-border rounded-md border border-bybs-border bg-white">
                    {detail.recentSubmissions.map((submission) => (
                      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between" key={submission._id}>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium text-bybs-navy">{submission.assignment?.title || "Assignment"}</p>
                          <p className="mt-1 text-xs text-bybs-muted">
                            {submission.assignment?.module?.title || "No module"} · Submitted {formatDate(submission.submittedAt, true)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={submission.status} />
                          {typeof submission.score === "number" ? <span className="text-sm font-medium text-bybs-navy">{submission.score}/{submission.assignment?.maxScore || 100}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>

              <DetailSection description="Recent sessions included in the progress calculation." title="Attendance history">
                {!attendanceHistory.length ? (
                  <p className="text-sm text-bybs-muted">No completed or past sessions are available yet.</p>
                ) : (
                  <div className="divide-y divide-bybs-border rounded-md border border-bybs-border bg-white">
                    {attendanceHistory.map((record) => (
                      <div className="flex items-center justify-between gap-3 p-3" key={record.sessionId}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-bybs-navy">{record.title}</p>
                          <p className="mt-1 text-xs text-bybs-muted">{formatDate(record.startsAt, true)}</p>
                        </div>
                        <StatusBadge status={record.attendanceStatus} />
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>

              <DetailSection title="Support and mentor questions">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-medium text-bybs-navy">Support tickets</h4>
                      <StatusBadge label={`${detail.support?.unresolved || 0} unresolved`} status={detail.support?.unresolved ? "open" : "resolved"} />
                    </div>
                    <div className="mt-3 space-y-2">
                      {detail.support?.recent?.length ? detail.support.recent.map((ticket) => (
                        <button className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-bybs-border bg-white px-3 py-2 text-left hover:bg-bybs-pale" key={ticket._id} onClick={() => onNavigate(`/support?ticket=${ticket._id}`)} type="button">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-bybs-navy">{ticket.subject}</span>
                            <span className="block text-xs text-bybs-muted">{ticket.category} · {formatDate(ticket.updatedAt)}</span>
                          </span>
                          <StatusBadge status={ticket.status} />
                        </button>
                      )) : <p className="text-sm text-bybs-muted">No support tickets.</p>}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-medium text-bybs-navy">Mentor questions</h4>
                      <StatusBadge label={`${detail.mentorQuestions?.unresolved || 0} unresolved`} status={detail.mentorQuestions?.unresolved ? "open" : "resolved"} />
                    </div>
                    {detail.mentorQuestions?.canViewSubjects ? (
                      <div className="mt-3 space-y-2">
                        {detail.mentorQuestions.recent?.length ? detail.mentorQuestions.recent.map((question) => (
                          <div className="rounded-md border border-bybs-border bg-white p-3" key={question._id}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="break-words text-sm font-medium text-bybs-navy">{question.subject}</p>
                                <p className="mt-1 text-xs text-bybs-muted">{question.module?.title || question.assignment?.title || "Learning question"} · {question.mentor?.name || "Mentor"}</p>
                              </div>
                              <StatusBadge status={question.status} />
                            </div>
                          </div>
                        )) : <p className="text-sm text-bybs-muted">No mentor questions.</p>}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-md bg-bybs-pale p-3 text-sm text-bybs-body">Question totals are visible. Subjects and messages remain limited to full admins.</p>
                    )}
                  </div>
                </div>
              </DetailSection>

              <DetailSection title="Certificate status">
                <div className="flex flex-col gap-3 rounded-md border border-bybs-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-bybs-navy">{detail.certificate?.certificateNumber || "No certificate issued"}</p>
                    <p className="mt-1 text-sm text-bybs-muted">
                      {detail.certificate ? `Last updated ${formatDate(detail.certificate.updatedAt)}` : "A mentor recommendation or issued certificate will appear here."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={detail.certificate?.status || "Not started"} status={detail.certificate?.status || "pending"} />
                    {detail.certificate ? <Button onClick={() => onNavigate(`/certificates?certificate=${detail.certificate._id}`)} size="sm" type="button" variant="secondary">Open certificate</Button> : null}
                  </div>
                </div>
              </DetailSection>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function LearnerOverviewPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCohortId = searchParams.get("cohort") || "";
  const requestedLearnerId = searchParams.get("student") || "";
  const [cohorts, setCohorts] = useState([]);
  const [cohortId, setCohortId] = useState(requestedCohortId);
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let active = true;
    adminApi.listCohorts()
      .then((response) => {
        if (!active) return;
        const nextCohorts = response.data || [];
        setCohorts(nextCohorts);
        const requestedExists = nextCohorts.some((cohort) => idFor(cohort) === requestedCohortId);
        const nextCohort = requestedExists
          ? requestedCohortId
          : idFor(nextCohorts.find((cohort) => cohort.status === "active") || nextCohorts[0]);
        setCohortId(nextCohort);
        if (nextCohort && !requestedExists) {
          const nextParams = new URLSearchParams(searchParams);
          nextParams.set("cohort", nextCohort);
          setSearchParams(nextParams, { replace: true });
        }
      })
      .catch((requestError) => active && setError(requestError.message));

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!cohortId) {
      setRows([]);
      setSummary(null);
      setIsLoading(false);
      return undefined;
    }

    let active = true;
    setIsLoading(true);
    setError("");
    adminApi.listLearnerOverview({ cohort: cohortId, page, ...appliedFilters })
      .then((response) => {
        if (!active) return;
        setRows(response.data || []);
        setSummary(response.summary || null);
        setMeta(response.meta || { page: 1, pages: 1, total: 0 });
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setIsLoading(false));

    return () => { active = false; };
  }, [cohortId, page, appliedFilters]);

  useEffect(() => {
    if (!requestedLearnerId) {
      setDetail(null);
      setDetailError("");
      return undefined;
    }

    let active = true;
    setDetail(null);
    setDetailLoading(true);
    setDetailError("");
    adminApi.getLearnerOverview(requestedLearnerId)
      .then((response) => active && setDetail(response.data))
      .catch((requestError) => active && setDetailError(requestError.message))
      .finally(() => active && setDetailLoading(false));

    return () => { active = false; };
  }, [requestedLearnerId]);

  const selectedCohort = useMemo(
    () => cohorts.find((cohort) => idFor(cohort) === cohortId),
    [cohorts, cohortId]
  );

  function changeCohort(nextCohortId) {
    setCohortId(nextCohortId);
    setPage(1);
    const nextParams = new URLSearchParams();
    if (nextCohortId) nextParams.set("cohort", nextCohortId);
    setSearchParams(nextParams);
  }

  function applyFilters(event) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters({ ...filters, search: filters.search.trim() });
  }

  function useSummaryFilter(nextFilters) {
    const merged = { ...initialFilters, ...nextFilters };
    setFilters(merged);
    setAppliedFilters(merged);
    setPage(1);
  }

  function resetFilters() {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  }

  function openLearner(row) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("cohort", cohortId);
    nextParams.set("student", idFor(row.student));
    setSearchParams(nextParams);
  }

  function closeLearner() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("student");
    setSearchParams(nextParams, { replace: true });
  }

  const tableColumns = [
    { key: "rank", header: "Rank", render: (row) => <span className="font-semibold text-bybs-navy">#{row.rank}</span> },
    { key: "student", header: "Mentee", render: (row) => <LearnerIdentity row={row} /> },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.student?.status} /> },
    { key: "progress", header: "Overall", render: (row) => <div className="w-36"><ProgressBar value={row.progress} /></div> },
    { key: "assignments", header: "Assignments", render: (row) => `${row.submittedCount}/${row.totalAssignments}` },
    { key: "attendance", header: "Attendance", render: (row) => `${row.attendancePercentage}%` },
    { key: "risk", header: "Flag", render: (row) => <RiskBadge risk={row.risk} /> },
    { key: "actions", header: "Action", render: (row) => <Button icon={Eye} onClick={() => openLearner(row)} size="sm" type="button" variant="secondary">View</Button> }
  ];

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <PageHeader
        description="Review objective progress, assignment activity, attendance, support, mentor questions, and graduation readiness in one cohort workspace."
        title="Learner overview"
      />

      <Card>
        <form className="grid gap-3 lg:grid-cols-[1.2fr_1.4fr_1fr_1fr_1fr_auto] lg:items-end" onSubmit={applyFilters}>
          <label className="block min-w-0">
            <span className="text-sm font-medium text-bybs-body">Cohort</span>
            <select className={`${inputClassName} mt-1`} onChange={(event) => changeCohort(event.target.value)} value={cohortId}>
              <option value="">Choose a cohort</option>
              {cohorts.map((cohort) => <option key={cohort._id} value={cohort._id}>{cohort.title}</option>)}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="text-sm font-medium text-bybs-body">Search</span>
            <input className={`${inputClassName} mt-1`} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Name, email, or mentor" value={filters.search} />
          </label>
          <label className="block min-w-0">
            <span className="text-sm font-medium text-bybs-body">Account</span>
            <select className={`${inputClassName} mt-1`} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} value={filters.status}>
              <option value="">All statuses</option>
              {["active", "inactive", "suspended", "completed"].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="text-sm font-medium text-bybs-body">Progress flag</span>
            <select className={`${inputClassName} mt-1`} onChange={(event) => setFilters((current) => ({ ...current, risk: event.target.value }))} value={filters.risk}>
              <option value="">All flags</option>
              <option value="needsAttention">Needs attention</option>
              <option value="watch">Watch</option>
              <option value="onTrack">On track</option>
            </select>
          </label>
          <label className="block min-w-0">
            <span className="text-sm font-medium text-bybs-body">Graduation</span>
            <select className={`${inputClassName} mt-1`} onChange={(event) => setFilters((current) => ({ ...current, readiness: event.target.value }))} value={filters.readiness}>
              <option value="">All learners</option>
              <option value="ready">Ready</option>
              <option value="notReady">Not ready</option>
            </select>
          </label>
          <div className="flex gap-2">
            <Button aria-label="Apply learner filters" icon={Search} size="icon" type="submit" />
            <Button aria-label="Reset learner filters" icon={X} onClick={resetFilters} size="icon" type="button" variant="secondary" />
          </div>
        </form>
      </Card>

      {error ? <p className="rounded-md bg-bybs-blush px-4 py-3 text-sm text-bybs-rose" role="alert">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={GraduationCap} label="Mentees" onClick={() => useSummaryFilter({})} tone="blue" value={summary?.learners || 0} />
        <StatCard icon={AlertTriangle} label="Needs attention" onClick={() => useSummaryFilter({ risk: "needsAttention" })} tone="rose" value={summary?.needsAttention || 0} />
        <StatCard icon={ShieldCheck} label="Graduation ready" onClick={() => useSummaryFilter({ readiness: "ready" })} tone="gold" value={summary?.graduationReady || 0} />
        <StatCard icon={Award} hint="Across the complete cohort" label="Average progress" tone="blue" value={`${summary?.averageProgress || 0}%`} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-bybs-navy">{selectedCohort?.title || "Cohort learners"}</h2>
          <p className="mt-1 text-sm text-bybs-body">Showing {meta.total || 0} matching learner{meta.total === 1 ? "" : "s"}. Rankings remain based on the full cohort.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-bybs-muted">
          <span>Assignments {summary?.averageAssignmentCompletion || 0}%</span>
          <span>·</span>
          <span>Score {summary?.averageScore || 0}%</span>
          <span>·</span>
          <span>Attendance {summary?.averageAttendance || 0}%</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3" role="status">
          {[0, 1, 2].map((item) => <div className="h-24 animate-pulse rounded-lg border border-bybs-border bg-white" key={item} />)}
          <span className="sr-only">Loading learner overview...</span>
        </div>
      ) : !cohortId ? (
        <EmptyState description="Choose a cohort to review its learner progress." icon={GraduationCap} title="Choose a cohort" />
      ) : !rows.length ? (
        <EmptyState description="No learners match the current cohort and filters." icon={Search} title="No matching learners" />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {rows.map((row) => (
              <article className="min-w-0 rounded-lg border border-bybs-border bg-white p-4 shadow-sm" key={idFor(row.student)}>
                <div className="flex items-start justify-between gap-3">
                  <LearnerIdentity row={row} />
                  <span className="shrink-0 text-sm font-semibold text-bybs-blue">#{row.rank}</span>
                </div>
                <div className="mt-4"><ProgressBar label="Overall progress" value={row.progress} /></div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Metric label="Assignments" value={`${row.submittedCount}/${row.totalAssignments}`} />
                  <Metric label="Attendance" value={`${row.attendancePercentage}%`} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <RiskBadge risk={row.risk} />
                  <Button icon={Eye} onClick={() => openLearner(row)} size="sm" type="button">View</Button>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden md:block">
            <DataTable columns={tableColumns} label="Cohort learner progress" rows={rows} />
          </div>
        </>
      )}

      {meta.pages > 1 ? (
        <nav aria-label="Learner overview pages" className="flex items-center justify-between gap-3">
          <Button disabled={page <= 1 || isLoading} icon={ChevronLeft} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button" variant="secondary">Previous</Button>
          <p className="text-sm text-bybs-body">Page {meta.page} of {meta.pages}</p>
          <Button disabled={page >= meta.pages || isLoading} icon={ChevronRight} onClick={() => setPage((current) => Math.min(meta.pages, current + 1))} type="button" variant="secondary">Next</Button>
        </nav>
      ) : null}

      <DetailDialog
        detail={detail}
        error={detailError}
        isLoading={detailLoading}
        learnerId={requestedLearnerId}
        onClose={closeLearner}
        onNavigate={(href) => {
          closeLearner();
          navigate(href);
        }}
      />
    </div>
  );
}
