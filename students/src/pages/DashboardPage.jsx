import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  LifeBuoy,
  MessageSquare,
  UserCheck
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  QuickAction,
  SectionHeader,
  StatCard,
  StatusBadge
} from "@bybs/shared";
import { studentApi } from "../services/api.js";
import { formatDate, formatDateTime, titleFor } from "../utils/format.js";

export function DashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    studentApi.dashboard()
      .then((response) => setDashboard(response.data))
      .catch((loadError) => setError(loadError.message));
  }, []);

  const summary = dashboard?.summary || {};
  const assignments = dashboard?.latestAssignments || [];
  const sessions = dashboard?.nextSessions || [];
  const notifications = dashboard?.notifications || [];

  return (
    <div className="space-y-6">
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
        description="Your next sessions, assignments, mentor updates, and learning resources in one place."
        title={`Welcome${dashboard?.user?.name ? `, ${dashboard.user.name.split(" ")[0]}` : ""}`}
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BookOpen} label="Assignments" tone="blue" value={summary.totalAssignments || 0} />
        <StatCard icon={CalendarCheck} label="Upcoming sessions" tone="blue" value={summary.upcomingSessions || 0} />
        <StatCard icon={ClipboardList} label="Pending assignments" tone="gold" value={summary.pendingAssignments || 0} />
        <StatCard icon={MessageSquare} label="Unread updates" tone="blue" value={summary.unreadNotifications || 0} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <SectionHeader
            description="Your progress is based on submitted assignments and reviewed work."
            title="Fellowship progress"
          />
          <ProgressBar label="Overall completion" value={summary.progress || 0} />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-bybs-pale p-4">
              <p className="text-sm text-bybs-muted">Submitted</p>
              <p className="mt-1 text-lg font-semibold text-bybs-navy">{summary.submittedCount || 0}</p>
            </div>
            <div className="rounded-md bg-bybs-pale p-4">
              <p className="text-sm text-bybs-muted">Still pending</p>
              <p className="mt-1 text-lg font-semibold text-bybs-navy">{summary.pendingAssignments || 0}</p>
            </div>
            <div className="rounded-md bg-bybs-pale p-4">
              <p className="text-sm text-bybs-muted">Status</p>
              <div className="mt-2">
                <StatusBadge status="active" />
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <QuickAction
            actionLabel="Open"
            description="View instructions, templates, deadlines, and submission status."
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
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Next sessions" />
          {!sessions.length ? (
            <EmptyState description="Scheduled sessions will appear here." title="No upcoming sessions" />
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div className="rounded-md bg-bybs-pale p-4" key={session._id}>
                  <p className="font-medium text-bybs-navy">{session.title}</p>
                  <p className="mt-1 text-sm text-bybs-body">{titleFor(session.module, "No module")} · {formatDateTime(session.startsAt)}</p>
                  {session.zoomLink ? (
                    <a className="mt-2 inline-block text-sm font-medium text-bybs-blue" href={session.zoomLink} rel="noreferrer" target="_blank">
                      Join session
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader title="Assignments due" />
          {!assignments.length ? (
            <EmptyState description="Published assignments will appear here." title="No assignments yet" />
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div className="rounded-md bg-white p-4 ring-1 ring-bybs-border" key={assignment._id}>
                  <p className="font-medium text-bybs-navy">{assignment.title}</p>
                  <p className="mt-1 text-sm text-bybs-body">{titleFor(assignment.module, "No module")} · Due {formatDate(assignment.dueDate)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {notifications.length ? (
        <Card>
          <SectionHeader title="Recent updates" />
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div className="rounded-md bg-bybs-pale p-4" key={notification._id}>
                <p className="font-medium text-bybs-navy">{notification.title}</p>
                <p className="mt-1 text-sm text-bybs-body">{notification.previewText || notification.message}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
