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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={GraduationCap} label="Active mentees" tone="blue" value={summary.students} />
        <StatCard icon={Users} label="Mentors" tone="blue" value={summary.mentors} />
        <StatCard icon={BookOpen} label="Current cohorts" tone="blue" value={summary.cohorts} />
        <StatCard icon={ClipboardCheck} label="Pending reviews" tone="gold" value={summary.pendingReviews} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
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

        <div className="space-y-4">
          <QuickAction
            actionLabel="Review"
            description="Check unresolved tickets, assignment issues, and access problems."
            icon={AlertTriangle}
            onClick={() => navigate("/support")}
            title="Support queue"
          />
          <QuickAction
            actionLabel="Prepare"
            description="Create modules, sessions, resources, and assignments for a cohort."
            icon={BookOpen}
            onClick={() => navigate("/modules")}
            title="Cohort setup"
          />
        </div>
      </div>
    </div>
  );
}
