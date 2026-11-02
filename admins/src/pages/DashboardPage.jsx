import {
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  ExternalLink,
  GraduationCap,
  Plus,
  Send,
  Users
} from "lucide-react";
import {
  Button,
  Card,
  DataTable,
  PageHeader,
  QuickAction,
  SectionHeader,
  StatCard,
  StatusBadge
} from "@bybs/shared";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnnouncementComposer } from "../components/AnnouncementComposer.jsx";
import { adminApi } from "../services/api.js";

function formatDateTime(value) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function DashboardPage() {
  const navigate = useNavigate();
  const composerRef = useRef(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [summary, setSummary] = useState({
    students: 0,
    mentors: 0,
    cohorts: 0,
    pendingReviews: 0,
    supportTickets: 0
  });
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    adminApi
      .dashboard()
      .then((response) => {
        if (isMounted) {
          setSummary(response.totals);
          setActivity(response.activity || []);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function openComposer() {
    setIsComposerOpen(true);
    window.requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button icon={Plus} onClick={() => navigate("/cohorts")} type="button">
              Create cohort
            </Button>
            <Button icon={Send} onClick={openComposer} type="button" variant="secondary">
              Send announcement
            </Button>
          </>
        }
        description="Track platform health, cohort activity, and items that need admin attention."
        title="Admin dashboard"
      />

      {error ? (
        <p className="rounded-md bg-bybs-gold/30 px-4 py-3 text-sm text-bybs-navy">
          {error}. Start the backend API and sign in with a seeded admin account to load live data.
        </p>
      ) : null}

      {isComposerOpen ? (
        <div ref={composerRef}>
          <AnnouncementComposer
            onCancel={() => setIsComposerOpen(false)}
            title="Send announcement from dashboard"
          />
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-32 items-center justify-center rounded-lg border border-bybs-border bg-white text-sm text-bybs-muted" role="status">
          Loading dashboard snapshot...
        </div>
      ) : (
        <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard icon={GraduationCap} label="Active mentees" onClick={() => navigate("/students")} tone="blue" value={summary.students} />
        <StatCard icon={Users} label="Mentors" onClick={() => navigate("/mentors")} tone="blue" value={summary.mentors} />
        <StatCard icon={BookOpen} label="Current cohorts" onClick={() => navigate("/cohorts")} tone="blue" value={summary.cohorts} />
        <StatCard icon={ClipboardCheck} label="Submissions to review" onClick={() => navigate("/assignments")} tone="gold" value={summary.pendingReviews} />
        <StatCard icon={AlertTriangle} label="Open support tickets" onClick={() => navigate("/support")} tone={summary.supportTickets ? "rose" : "blue"} value={summary.supportTickets} />
      </div>

      <section aria-label="Needs attention" className="space-y-3">
        <SectionHeader
          description="Start with outstanding learner and support needs, then continue program setup."
          title="Needs attention"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <QuickAction
            actionLabel={summary.pendingReviews ? "Review submissions" : "Open assignments"}
            description={summary.pendingReviews
              ? `${summary.pendingReviews} submission${summary.pendingReviews === 1 ? " is" : "s are"} waiting for review.`
              : "Check assignment activity and learner submissions."}
            icon={ClipboardCheck}
            onClick={() => navigate("/assignments")}
            title="Assignment review"
          />
          <QuickAction
            actionLabel={summary.supportTickets ? "Open support queue" : "View support"}
            description={summary.supportTickets
              ? `${summary.supportTickets} support ticket${summary.supportTickets === 1 ? " needs" : "s need"} follow-up.`
              : "Review learner support requests and their progress."}
            icon={AlertTriangle}
            onClick={() => navigate("/support")}
            title="Support queue"
          />
          <QuickAction
            actionLabel="Prepare cohort"
            description="Set up modules, sessions, resources, and assignments."
            icon={BookOpen}
            onClick={() => navigate("/modules")}
            title="Program setup"
          />
          <QuickAction
            actionLabel="Send update"
            description="Share a program announcement with the selected audience."
            icon={Send}
            onClick={openComposer}
            title="Communicate"
          />
        </div>
      </section>
        </>
      )}

      <div>
        <Card>
          <SectionHeader
            description="Live stream of assignments, reports, bookings, support tickets, sessions, and system events."
            title="Recent activity"
          />
          {isLoading ? (
            <div className="rounded-lg border border-bybs-border bg-white p-8 text-center text-sm text-bybs-muted">
              Loading recent activity...
            </div>
          ) : (
            <DataTable
              columns={[
                { key: "source", header: "Type" },
                { key: "item", header: "Item", wrap: true },
                { key: "owner", header: "Owner" },
                { key: "occurredAt", header: "When", render: (row) => formatDateTime(row.occurredAt) },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <StatusBadge status={row.status} />
                },
                {
                  key: "action",
                  header: "Action",
                  render: (row) => (
                    <Button icon={ExternalLink} onClick={() => navigate(row.href || "/")} size="sm" type="button" variant="secondary">
                      Open
                    </Button>
                  )
                }
              ]}
              emptyDescription="Recent assignments, reports, bookings, tickets, sessions, and system events will appear here."
              emptyTitle="No recent activity yet"
              rows={activity}
            />
          )}
        </Card>

      </div>
    </div>
  );
}
