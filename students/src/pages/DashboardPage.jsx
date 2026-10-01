import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Clock3,
  LifeBuoy,
  Loader2,
  MessageSquare,
  RotateCcw,
  TrendingUp,
  UserCheck
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AddToCalendarButton,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  QuickAction,
  SectionHeader,
  StatCard,
  StatusBadge,
  formatAssignmentDeadline
} from "@bybs/shared";
import { studentApi } from "../services/api.js";
import { formatCatDateTime, formatDate, formatDateTime, titleFor } from "../utils/format.js";

function mentorName(mentor) {
  return mentor?.name || mentor?.email || "BYBS mentor";
}

function sessionMentorName(session) {
  return mentorName(session?.module?.assignedMentor);
}

function assignmentHref(assignment) {
  return assignment?._id ? `/app/assignments?assignment=${assignment._id}` : "/app/assignments";
}

function sessionCalendarEvent(session) {
  return {
    id: session._id,
    title: `BYBS session: ${session.title}`,
    description: `${titleFor(session.module, "Module session")} with ${sessionMentorName(session)}.`,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    location: session.zoomLink || "BYBS LMS",
    url: session.zoomLink || ""
  };
}

function moduleTimelineLabel(status) {
  if (status === "upcoming") return "Upcoming module";
  if (status === "completed") return "Most recent module";
  return "Current module";
}

function actionLabel(type) {
  if (type === "revision") return "Open revision";
  if (type === "assignment" || type === "overdueAssignment") return "Open assignment";
  if (type === "module") return "Continue learning";
  if (type === "session") return "View session";
  return "View progress";
}

function feedbackLabel(status) {
  if (status === "needsRevision") return "Revision requested";
  if (status === "approved") return "Approved";
  return "Feedback published";
}

function scoreLabel(feedback) {
  if (typeof feedback?.score !== "number") return null;
  return `${feedback.score}/${feedback.assignment?.maxScore || 100}`;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [upcomingAvailability, setUpcomingAvailability] = useState([]);
  const [availabilityError, setAvailabilityError] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.allSettled([studentApi.dashboard(), studentApi.listAvailability()])
      .then(([dashboardResult, availabilityResult]) => {
        if (!isMounted) return;

        if (dashboardResult.status === "fulfilled") {
          setDashboard(dashboardResult.value.data);
        } else {
          setError(dashboardResult.reason?.message || "The dashboard could not be loaded.");
        }

        if (availabilityResult.status === "fulfilled") {
          setUpcomingAvailability((availabilityResult.value.upcoming || []).slice(0, 3));
        } else {
          setAvailabilityError(availabilityResult.reason?.message || "Mentor availability could not be loaded.");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const summary = dashboard?.summary || {};
  const currentModule = dashboard?.currentModule;
  const nextAction = dashboard?.nextAction;
  const upcoming = dashboard?.upcoming || {};
  const feedback = dashboard?.recentFeedback;
  const sessions = dashboard?.nextSessions || [];
  const notifications = dashboard?.notifications || [];
  const moduleAssignmentSummary = currentModule?.assignmentSummary || {};
  const continueAssignment = currentModule?.nextAssignment;

  const upcomingItems = [
    upcoming.revisionRequest
      ? {
          id: `revision-${upcoming.revisionRequest._id}`,
          icon: RotateCcw,
          label: "Revision requested",
          title: upcoming.revisionRequest.assignment?.title,
          detail: upcoming.revisionRequest.feedbackPreview,
          onClick: () => navigate(assignmentHref(upcoming.revisionRequest.assignment)),
          tone: "warning"
        }
      : null,
    upcoming.overdueAssignment
      ? {
          id: `overdue-${upcoming.overdueAssignment._id}`,
          icon: Clock3,
          label: "Past due",
          title: upcoming.overdueAssignment.title,
          detail: `Due ${formatAssignmentDeadline(upcoming.overdueAssignment.dueDate)}`,
          onClick: () => navigate(assignmentHref(upcoming.overdueAssignment)),
          tone: "danger"
        }
      : null,
    upcoming.nearestDeadline
      ? {
          id: `deadline-${upcoming.nearestDeadline._id}`,
          icon: ClipboardList,
          label: "Nearest deadline",
          title: upcoming.nearestDeadline.title,
          detail: `Due ${formatAssignmentDeadline(upcoming.nearestDeadline.dueDate)}`,
          onClick: () => navigate(assignmentHref(upcoming.nearestDeadline)),
          tone: "info"
        }
      : null,
    upcoming.nextSession
      ? {
          id: `session-${upcoming.nextSession._id}`,
          icon: CalendarCheck,
          label: "Next session",
          title: upcoming.nextSession.title,
          detail: formatCatDateTime(upcoming.nextSession.startsAt),
          onClick: () => document.getElementById("next-sessions")?.scrollIntoView({ behavior: "smooth", block: "start" }),
          tone: "info"
        }
      : null
  ].filter(Boolean);

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-6">
      <PageHeader
        actions={
          <>
            <Button icon={UserCheck} onClick={() => navigate("/app/bookings")} type="button">
              Book 1:1
            </Button>
            <Button icon={LifeBuoy} onClick={() => navigate("/app/support")} type="button" variant="secondary">
              Contact support
            </Button>
          </>
        }
        description={dashboard?.user?.cohort?.title
          ? `${dashboard.user.cohort.title} · Stay focused on the next meaningful step.`
          : "Stay focused on the next meaningful step in your fellowship."}
        title={`Welcome${dashboard?.user?.name ? `, ${dashboard.user.name.split(" ")[0]}` : ""}`}
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center rounded-lg border border-bybs-border bg-white text-sm text-bybs-muted" role="status">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-bybs-blue" aria-hidden="true" />
          Loading your dashboard...
        </div>
      ) : null}

      {!isLoading && dashboard ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard icon={TrendingUp} label="Overall progress" onClick={() => navigate("/app/progress")} tone="blue" value={`${summary.progress || 0}%`} />
            <StatCard icon={ClipboardList} label="Assignments submitted" onClick={() => navigate("/app/assignments")} tone="blue" value={`${summary.submittedCount || 0}/${summary.totalAssignments || 0}`} />
            <StatCard icon={RotateCcw} label="Needs revision" onClick={() => navigate("/app/assignments?filter=todo")} tone="gold" value={summary.needsRevisionCount || 0} />
            <StatCard icon={MessageSquare} label="Unread updates" onClick={() => navigate("/app/notifications")} tone="blue" value={summary.unreadNotifications || 0} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <Card>
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-bybs-blue">Your next step</p>
                    <h2 className="mt-2 break-words text-xl font-semibold text-bybs-navy">{nextAction?.title}</h2>
                    <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-bybs-body">{nextAction?.description}</p>
                  </div>
                  <Button className="shrink-0" icon={ArrowRight} onClick={() => navigate(nextAction?.href || "/app/progress")} type="button">
                    {actionLabel(nextAction?.type)}
                  </Button>
                </div>
              </Card>

              <Card>
                <SectionHeader
                  description="Keep your learning and assignment work moving together."
                  title={moduleTimelineLabel(currentModule?.timelineStatus)}
                />
                {!currentModule ? (
                  <EmptyState description="Published modules will appear here once your cohort begins." title="No module available yet" />
                ) : (
                  <div className="min-w-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-semibold text-bybs-navy">{currentModule.title}</h3>
                        <p className="mt-1 text-sm text-bybs-body">
                          {currentModule.startDate || currentModule.endDate
                            ? `${formatDate(currentModule.startDate)} - ${formatDate(currentModule.endDate)}`
                            : "Module dates will be shared here."}
                        </p>
                        <p className="mt-1 text-sm text-bybs-muted">Mentor: {mentorName(currentModule.assignedMentor)}</p>
                      </div>
                      <StatusBadge label={moduleTimelineLabel(currentModule.timelineStatus)} status={currentModule.timelineStatus === "completed" ? "completed" : "active"} />
                    </div>
                    <div className="mt-5">
                      <ProgressBar label="Module assignment progress" value={moduleAssignmentSummary.progress || 0} />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <p className="text-sm text-bybs-body">
                        {moduleAssignmentSummary.submitted || 0} of {moduleAssignmentSummary.total || 0} assignments submitted
                      </p>
                      <Button
                        icon={ArrowRight}
                        onClick={() => navigate(continueAssignment ? assignmentHref(continueAssignment) : "/app/materials")}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        {continueAssignment ? "Continue module assignment" : "Open learning materials"}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            <Card>
              <SectionHeader
                description="The commitments that need your attention first."
                title="Upcoming"
              />
              {!upcomingItems.length ? (
                <EmptyState description="New sessions, deadlines, and revision requests will appear here." title="Nothing urgent right now" />
              ) : (
                <div className="space-y-3">
                  {upcomingItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        className="flex min-h-11 w-full min-w-0 items-start gap-3 rounded-md border border-bybs-border bg-white p-3 text-left transition hover:border-bybs-blue hover:bg-bybs-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bybs-blue"
                        key={item.id}
                        onClick={item.onClick}
                        type="button"
                      >
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bybs-pale text-bybs-blue">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="break-words text-sm font-semibold text-bybs-navy">{item.title}</span>
                            <StatusBadge label={item.label} status={item.tone === "danger" ? "lateSubmission" : item.tone === "warning" ? "needsRevision" : "scheduled"} />
                          </span>
                          <span className="mt-1 block break-words text-xs leading-5 text-bybs-muted">{item.detail}</span>
                        </span>
                        <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-bybs-blue" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <SectionHeader
                action={<Button onClick={() => navigate("/app/progress")} size="sm" type="button" variant="secondary">View details</Button>}
                description="Calculated from your assignment completion, approved scores, attendance, and punctuality."
                title="Progress summary"
              />
              <ProgressBar label="Overall progress" value={summary.progress || 0} />
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  ["Assignment completion", summary.assignmentCompletionPercentage || 0],
                  ["Approved score", summary.scorePercentage || 0],
                  ["Attendance", summary.attendancePercentage || 0],
                  ["Punctuality", summary.punctualityPercentage || 0]
                ].map(([label, value]) => (
                  <div className="min-w-0 rounded-md bg-bybs-pale p-3" key={label}>
                    <p className="break-words text-xs text-bybs-muted">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-bybs-navy">{value}%</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <SectionHeader
                description="Your latest published mentor review."
                title="Recent feedback"
              />
              {!feedback ? (
                <EmptyState description="Published mentor feedback will appear here after your work is reviewed." title="No feedback yet" />
              ) : (
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={feedbackLabel(feedback.status)} status={feedback.status} />
                    {scoreLabel(feedback) ? <StatusBadge label={`Score ${scoreLabel(feedback)}`} status="approved" /> : null}
                  </div>
                  <h3 className="mt-4 break-words text-lg font-semibold text-bybs-navy">{feedback.assignment?.title}</h3>
                  <p className="mt-2 break-words text-sm leading-6 text-bybs-body">{feedback.feedbackPreview}</p>
                  <p className="mt-3 text-xs text-bybs-muted">
                    {feedback.reviewedBy?.name ? `Reviewed by ${feedback.reviewedBy.name}` : "Reviewed"}
                    {feedback.reviewedAt ? ` · ${formatDateTime(feedback.reviewedAt)}` : ""}
                  </p>
                  <Button className="mt-4" icon={ArrowRight} onClick={() => navigate(assignmentHref(feedback.assignment))} size="sm" type="button">
                    Open full feedback
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <SectionHeader title="Next sessions" />
              <div className="min-w-0 scroll-mt-24" id="next-sessions">
                {!sessions.length ? (
                  <EmptyState description="Scheduled sessions will appear here." title="No upcoming sessions" />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {sessions.map((session) => (
                      <div className="min-w-0 rounded-md bg-bybs-pale p-4" key={session._id}>
                        <p className="break-words font-medium text-bybs-navy">{session.title}</p>
                        <p className="mt-1 break-words text-sm text-bybs-body">{titleFor(session.module, "No module")} · {formatCatDateTime(session.startsAt)}</p>
                        <p className="mt-1 text-xs text-bybs-muted">Mentor: {sessionMentorName(session)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {session.zoomLink ? (
                            <Button as="a" href={session.zoomLink} rel="noreferrer" size="sm" target="_blank">Join session</Button>
                          ) : null}
                          <AddToCalendarButton event={sessionCalendarEvent(session)} fileName={`bybs-session-${session._id}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <SectionHeader
                description="Upcoming bookable times from your cohort mentors."
                title="Mentor availability"
              />
              {availabilityError ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{availabilityError}</p> : null}
              {!availabilityError && !upcomingAvailability.length ? (
                <EmptyState description="No mentor availability has been published yet." title="No slots yet" />
              ) : (
                <div className="space-y-3">
                  {upcomingAvailability.map((slot) => (
                    <div className="rounded-md bg-bybs-pale p-4" key={`${slot.mentorId || ""}-${slot.availabilitySlot}-${slot.startsAt}`}>
                      <p className="font-medium text-bybs-navy">{mentorName(slot.mentor)}</p>
                      <p className="mt-1 text-sm text-bybs-body">{formatDateTime(slot.startsAt)}</p>
                    </div>
                  ))}
                  <Button icon={CalendarCheck} onClick={() => navigate("/app/bookings")} size="sm" type="button" variant="secondary">
                    Book a slot
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <QuickAction
              actionLabel="Open"
              description="View instructions, deadlines, submissions, and mentor feedback."
              icon={ClipboardList}
              onClick={() => navigate("/app/assignments")}
              title="Assignments"
            />
            <QuickAction
              actionLabel="Browse"
              description="Access slides, recordings, templates, links, and readings for your cohort."
              icon={BookOpen}
              onClick={() => navigate("/app/materials")}
              title="Learning materials"
            />
          </div>

          {notifications.length ? (
            <Card>
              <SectionHeader
                action={<Button onClick={() => navigate("/app/notifications")} size="sm" type="button" variant="secondary">All notifications</Button>}
                title="Recent updates"
              />
              <div className="grid gap-3 md:grid-cols-2">
                {notifications.slice(0, 4).map((notification) => (
                  <button
                    className="min-h-11 min-w-0 rounded-md bg-bybs-pale p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bybs-blue"
                    key={notification._id}
                    onClick={() => navigate("/app/notifications")}
                    type="button"
                  >
                    <span className="block break-words font-medium text-bybs-navy">{notification.title}</span>
                    <span className="mt-1 block break-words text-sm text-bybs-body">{notification.previewText || notification.message}</span>
                  </button>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
