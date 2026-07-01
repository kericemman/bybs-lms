import { ClipboardCheck, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, DataTable, PageHeader, StatusBadge } from "@bybs/shared";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { mentorApi } from "../services/api.js";
import { formatDateTime } from "../utils/format.js";

const statusOptions = [
  { value: "", label: "All submissions" },
  { value: "submitted", label: "Submitted" },
  { value: "lateSubmission", label: "Late submissions" },
  { value: "needsRevision", label: "Needs revision" },
  { value: "reviewed", label: "Reviewed" },
  { value: "approved", label: "Approved" }
];

const reviewStatuses = [
  { value: "reviewed", label: "Reviewed" },
  { value: "needsRevision", label: "Needs revision" },
  { value: "approved", label: "Approved" }
];

function initialReviewForm(submission) {
  return {
    score: submission?.score ?? "",
    feedback: submission?.feedback || "",
    status: submission?.status === "approved" ? "approved" : submission?.status === "needsRevision" ? "needsRevision" : "reviewed"
  };
}

export function ReviewsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [status, setStatus] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [form, setForm] = useState(() => initialReviewForm());
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadSubmissions() {
    const response = await mentorApi.listSubmissions({ status });
    setSubmissions(response.data);
  }

  useEffect(() => {
    loadSubmissions().catch((requestError) => setError(requestError.message));
  }, [status]);

  function startReview(submission) {
    setSelectedSubmission(submission);
    setForm(initialReviewForm(submission));
    setError("");
    setFeedback("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelReview() {
    setSelectedSubmission(null);
    setForm(initialReviewForm());
  }

  async function submitReview(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      await mentorApi.reviewSubmission(selectedSubmission._id, {
        ...form,
        score: form.score === "" ? undefined : Number(form.score)
      });
      setFeedback("Review saved.");
      cancelReview();
      await loadSubmissions();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review submissions, add scores, leave feedback, and request resubmission where needed."
        title="Review submissions"
      />

      {selectedSubmission ? (
        <Card>
          <form className="grid gap-4 lg:grid-cols-3" onSubmit={submitReview}>
            <div className="lg:col-span-3">
              <p className="text-sm font-semibold uppercase text-bybs-blue">Reviewing submission</p>
              <h2 className="mt-1 text-lg font-semibold text-bybs-navy">{selectedSubmission.assignment?.title || "Assignment"}</h2>
              <p className="mt-1 text-sm text-bybs-body">{selectedSubmission.student?.name || "Student"}</p>
            </div>
            <FormField label={`Score${selectedSubmission.assignment?.maxScore ? ` / ${selectedSubmission.assignment.maxScore}` : ""}`}>
              <input
                className={inputClassName}
                max={selectedSubmission.assignment?.maxScore || 1000}
                min="0"
                onChange={(event) => setForm((current) => ({ ...current, score: event.target.value }))}
                type="number"
                value={form.score}
              />
            </FormField>
            <FormField label="Review status">
              <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} value={form.status}>
                {reviewStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FormField>
            <div className="lg:col-span-3">
              <FormField label="Feedback">
                <textarea
                  className={textAreaClassName}
                  onChange={(event) => setForm((current) => ({ ...current, feedback: event.target.value }))}
                  placeholder="Add practical feedback, encouragement, and any required changes."
                  value={form.feedback}
                />
              </FormField>
            </div>
            <div className="flex flex-wrap gap-2 lg:col-span-3">
              <Button disabled={isSubmitting} icon={Save} type="submit">{isSubmitting ? "Saving..." : "Save review"}</Button>
              <Button icon={X} onClick={cancelReview} type="button" variant="secondary">Cancel</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-bybs-border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-bybs-navy">
          <ClipboardCheck className="h-4 w-4 text-bybs-blue" aria-hidden="true" />
          Submission queue
        </div>
        <select className={`${inputClassName} max-w-56`} onChange={(event) => setStatus(event.target.value)} value={status}>
          {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      <DataTable
        columns={[
          { key: "student", header: "Student", render: (row) => row.student?.name || "Student" },
          { key: "assignment", header: "Assignment", render: (row) => row.assignment?.title || "Assignment" },
          { key: "submittedAt", header: "Submitted", render: (row) => formatDateTime(row.submittedAt) },
          { key: "score", header: "Score", render: (row) => row.score ?? "Not scored" },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <Button icon={ClipboardCheck} onClick={() => startReview(row)} size="sm" type="button" variant="secondary">
                Review
              </Button>
            )
          }
        ]}
        emptyDescription="Submitted assignments will appear here once students begin uploading work."
        emptyTitle="No submissions waiting"
        rows={submissions}
      />
    </div>
  );
}
