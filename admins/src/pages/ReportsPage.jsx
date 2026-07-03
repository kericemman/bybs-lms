import { Eye, MessageSquare, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, DataTable, PageHeader, SafeHtml, StatusBadge } from "@bybs/shared";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { adminApi } from "../services/api.js";
import { formatDateTime, relatedTitle } from "../utils/format.js";

const reviewStatusOptions = [
  { value: "", label: "Keep current status" },
  { value: "submitted", label: "Submitted" },
  { value: "reviewed", label: "Reviewed" },
  { value: "clarificationRequested", label: "Request clarification" },
  { value: "resolved", label: "Resolved" }
];

function initialReviewForm() {
  return {
    reviewStatus: "",
    comment: ""
  };
}

function peopleList(people = []) {
  return people.map((person) => person.name || person.email).filter(Boolean).join(", ") || "None listed";
}

export function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reviewForm, setReviewForm] = useState(() => initialReviewForm());
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadReports() {
    const response = await adminApi.listReports();
    setReports(response.data);
    setSelectedReport((current) =>
      current ? response.data.find((report) => report._id === current._id) || current : current
    );
  }

  useEffect(() => {
    loadReports().catch((requestError) => setError(requestError.message));
  }, []);

  function chooseReport(report) {
    setSelectedReport(report);
    setReviewForm({
      reviewStatus: "",
      comment: ""
    });
    setError("");
    setFeedback("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitReview(event) {
    event.preventDefault();
    if (!selectedReport) return;

    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      const payload = {
        comment: reviewForm.comment
      };

      if (reviewForm.reviewStatus) {
        payload.reviewStatus = reviewForm.reviewStatus;
      }

      const response = await adminApi.updateReportReview(selectedReport._id, payload);
      setSelectedReport(response.data);
      setReviewForm(initialReviewForm());
      setFeedback("Report review updated.");
      await loadReports();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review weekly and monthly mentor reports, comment on risks, and request clarification when needed."
        title="Reports"
      />
      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      {selectedReport ? (
        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-bybs-blue">Report detail</p>
              <h2 className="mt-1 text-lg font-semibold text-bybs-navy">
                {relatedTitle(selectedReport.mentor)} · {selectedReport.period} report
              </h2>
              <p className="mt-1 text-sm text-bybs-body">
                {relatedTitle(selectedReport.cohort, "Cohort")} · Submitted {formatDateTime(selectedReport.submittedAt || selectedReport.createdAt)}
              </p>
            </div>
            <StatusBadge status={selectedReport.reviewStatus || "submitted"} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-md bg-bybs-pale p-4">
              <p className="text-sm text-bybs-muted">Active mentees</p>
              <p className="mt-1 text-lg font-semibold text-bybs-navy">{selectedReport.activeStudentCount || 0}</p>
            </div>
            <div className="rounded-md bg-bybs-pale p-4">
              <p className="text-sm font-semibold text-bybs-navy">Doing well</p>
              <p className="mt-1 text-sm text-bybs-body">{peopleList(selectedReport.studentsDoingWell)}</p>
            </div>
            <div className="rounded-md bg-bybs-blush p-4">
              <p className="text-sm font-semibold text-bybs-navy">At risk</p>
              <p className="mt-1 text-sm text-bybs-body">{peopleList(selectedReport.studentsAtRisk)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              ["Assignment completion", selectedReport.assignmentCompletionSummary],
              ["Attendance concerns", selectedReport.attendanceConcerns],
              ["Observations", selectedReport.observations],
              ["Recommendations", selectedReport.recommendations],
              ["Support needed", selectedReport.supportNeeded]
            ].map(([label, value]) => (
              <div className="rounded-md border border-bybs-border p-4" key={label}>
                <p className="text-sm font-semibold text-bybs-navy">{label}</p>
                <SafeHtml className="mt-2 text-sm leading-6 text-bybs-body" html={value || "None listed"} />
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <form className="rounded-md border border-bybs-border p-4" onSubmit={submitReview}>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-bybs-blue" />
                <h3 className="text-base font-semibold text-bybs-navy">Admin response</h3>
              </div>
              <div className="mt-4 space-y-4">
                <FormField label="Review action">
                  <select
                    className={inputClassName}
                    onChange={(event) => setReviewForm((current) => ({ ...current, reviewStatus: event.target.value }))}
                    value={reviewForm.reviewStatus}
                  >
                    {reviewStatusOptions.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Comment or clarification request">
                  <textarea
                    className={textAreaClassName}
                    onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))}
                    placeholder="Add a comment, note what needs clarification, or confirm what was reviewed."
                    value={reviewForm.comment}
                  />
                </FormField>
                <Button disabled={isSubmitting} icon={Send} type="submit">
                  {isSubmitting ? "Sending..." : "Send response"}
                </Button>
              </div>
            </form>

            <div>
              <h3 className="text-base font-semibold text-bybs-navy">Review history</h3>
              {!selectedReport.adminComments?.length ? (
                <p className="mt-3 rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-body">No admin comments yet.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {selectedReport.adminComments.map((comment) => (
                    <article className="rounded-md border border-bybs-border p-4" key={comment._id || comment.createdAt}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-bybs-navy">{comment.admin?.name || "Admin"}</p>
                        <StatusBadge label={comment.action === "clarification" ? "Clarification" : comment.status} status={comment.status || "reviewed"} />
                      </div>
                      <SafeHtml className="mt-2 text-sm leading-6 text-bybs-body" html={comment.message} />
                      <p className="mt-2 text-xs text-bybs-muted">{formatDateTime(comment.createdAt)}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      <DataTable
        columns={[
          { key: "mentor", header: "Mentor", render: (row) => relatedTitle(row.mentor) },
          { key: "cohort", header: "Cohort", render: (row) => relatedTitle(row.cohort) },
          { key: "period", header: "Period" },
          { key: "reviewStatus", header: "Review", render: (row) => <StatusBadge status={row.reviewStatus || "submitted"} /> },
          { key: "activeStudentCount", header: "Active mentees" },
          { key: "submittedAt", header: "Submitted", render: (row) => formatDateTime(row.submittedAt) },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <Button icon={Eye} onClick={() => chooseReport(row)} size="sm" type="button" variant="secondary">
                View
              </Button>
            )
          }
        ]}
        emptyDescription="Mentor reports will appear here after mentors submit them."
        rows={reports}
      />
    </div>
  );
}
