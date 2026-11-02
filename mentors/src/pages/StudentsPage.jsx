import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Eye, UsersRound } from "lucide-react";
import { Button, DataTable, PageHeader, ProgressBar, StatusBadge, formatInternationalPhone } from "@bybs/shared";
import { mentorApi } from "../services/api.js";
import { formatDate } from "../utils/format.js";

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "B"}${parts[1]?.[0] || ""}`.toUpperCase();
}

export function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [listView, setListView] = useState("current");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError("");
    mentorApi
      .listStudents({ statusGroup: listView })
      .then((response) => {
        if (isMounted) setStudents(response.data);
      })
      .catch((requestError) => {
        if (isMounted) setError(requestError.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, [listView]);

  return (
    <div className="space-y-6">
      <PageHeader
        description="View assigned mentees, progress, submissions, attendance, notes, and risk status. Suspended mentees are kept in a separate view."
        title="Assigned mentees"
      />
      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      <div aria-label="Mentee account view" className="flex flex-wrap gap-2" role="tablist">
        <button
          aria-selected={listView === "current"}
          className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium ${listView === "current" ? "bg-bybs-blue text-white" : "border border-bybs-border bg-white text-bybs-body hover:bg-bybs-pale"}`}
          onClick={() => setListView("current")}
          role="tab"
          type="button"
        >
          <UsersRound className="h-4 w-4" aria-hidden="true" /> Current mentees
        </button>
        <button
          aria-selected={listView === "suspended"}
          className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium ${listView === "suspended" ? "bg-bybs-blue text-white" : "border border-bybs-border bg-white text-bybs-body hover:bg-bybs-pale"}`}
          onClick={() => setListView("suspended")}
          role="tab"
          type="button"
        >
          <Archive className="h-4 w-4" aria-hidden="true" /> Suspended
        </button>
      </div>
      <DataTable
        columns={[
          {
            key: "name",
            header: "Mentee",
            render: (row) => (
              <Link className="inline-flex min-w-52 items-center gap-3 rounded-md transition hover:text-bybs-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bybs-pale" to={`/students/${row.id}`}>
                {row.profileImage ? (
                  <img alt={row.name} className="h-10 w-10 rounded-full border border-bybs-border object-cover" src={row.profileImage} />
                ) : (
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-bybs-border bg-bybs-pale text-sm font-semibold text-bybs-blue">
                    {initials(row.name)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium text-bybs-navy">{row.name}</span>
                  <span className="block truncate text-xs text-bybs-muted">{row.email}</span>
                </span>
              </Link>
            )
          },
          { key: "phone", header: "Phone", render: (row) => formatInternationalPhone(row.phone) },
          { key: "cohort", header: "Cohort", render: (row) => row.cohort?.title || "Unassigned" },
          {
            key: "progress",
            header: "Progress",
            render: (row) => <div className="w-44"><ProgressBar value={row.progress} /></div>
          },
          { key: "submissions", header: "Submissions", render: (row) => `${row.submittedCount}/${row.totalAssignments}` },
          { key: "lastSubmissionAt", header: "Last submission", render: (row) => formatDate(row.lastSubmissionAt) },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />
          },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <Button as={Link} icon={Eye} size="sm" to={`/students/${row.id}`} variant="secondary">
                View
              </Button>
            )
          }
        ]}
        emptyDescription={isLoading ? "Loading mentees..." : listView === "suspended" ? "No suspended mentees are assigned to you or your cohort." : "Current mentees assigned to you or your cohort will appear here."}
        emptyTitle={isLoading ? "Loading mentees" : undefined}
        rows={students}
      />
    </div>
  );
}
