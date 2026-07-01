import { useEffect, useState } from "react";
import { DataTable, PageHeader } from "@bybs/shared";
import { adminApi } from "../services/api.js";
import { formatDateTime, relatedTitle } from "../utils/format.js";

export function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .listReports()
      .then((response) => setReports(response.data))
      .catch((requestError) => setError(requestError.message));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review weekly and monthly mentor reports for cohort health and student risk."
        title="Reports"
      />
      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      <DataTable
        columns={[
          { key: "mentor", header: "Mentor", render: (row) => relatedTitle(row.mentor) },
          { key: "cohort", header: "Cohort", render: (row) => relatedTitle(row.cohort) },
          { key: "period", header: "Period" },
          { key: "activeStudentCount", header: "Active students" },
          { key: "submittedAt", header: "Submitted", render: (row) => formatDateTime(row.submittedAt) }
        ]}
        emptyDescription="Mentor reports will appear here after mentors submit them."
        rows={reports}
      />
    </div>
  );
}
