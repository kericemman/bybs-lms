import { BookOpen, ClipboardCheck, ExternalLink, Eye, MessageSquare, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, DataTable, EmptyState, PageHeader, RichTextEditor, SafeHtml, SectionHeader, StatusBadge } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { FormField, inputClassName } from "../components/FormField.jsx";
import { mentorApi } from "../services/api.js";
import { formatDate, formatDateTime } from "../utils/format.js";

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

const emptyModuleStats = { assignments: 0, submitted: 0, pending: 0, late: 0 };

const contentClassName =
  "rounded-md bg-bybs-pale p-4 text-sm leading-6 text-bybs-body [&_a]:font-medium [&_a]:text-bybs-blue [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-bybs-rose [&_blockquote]:bg-bybs-blush [&_blockquote]:px-4 [&_blockquote]:py-2 [&_h2]:mb-2 [&_h2]:mt-5 [&_h2:first-child]:mt-0 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-bybs-navy [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-bybs-blue [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-bybs-border [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p]:my-2 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1";

function idFor(value) {
  return String(value?._id || value?.id || value || "");
}

function moduleDates(module) {
  if (!module?.startDate && !module?.endDate) return "Dates not set";
  return `${formatDate(module.startDate)} - ${formatDate(module.endDate)}`;
}

function moduleStats(module) {
  return module?.stats || emptyModuleStats;
}

function initialReviewForm(submission) {
  return {
    score: submission?.score ?? "",
    feedback: submission?.feedback || "",
    status: submission?.status === "approved" ? "approved" : submission?.status === "needsRevision" ? "needsRevision" : "reviewed"
  };
}

function initialMessageForm(submission) {
  return {
    title: submission?.assignment?.title ? `About ${submission.assignment.title}` : "Assignment feedback",
    message: ""
  };
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function containsHtml(value = "") {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function renderInstructionsHtml(value = "") {
  const source = String(value || "").trim();
  if (!source) return "<p>No assignment instructions were provided.</p>";
  if (containsHtml(source) && !source.includes("## ")) return source;

  return source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      const heading = trimmed.match(/^#{2,3}\s+(.+)$/);
      if (heading) return `<h2>${escapeHtml(heading[1])}</h2>`;
      return containsHtml(trimmed) ? trimmed : `<p>${escapeHtml(trimmed)}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

function attachmentKind(url = "") {
  const cleanUrl = String(url).split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif)$/.test(cleanUrl)) return "image";
  if (cleanUrl.endsWith(".pdf")) return "pdf";
  if (cleanUrl.includes("docs.google.com")) return "document";
  return "file";
}

function AttachmentPreview({ url }) {
  if (!url) {
    return (
      <p className="rounded-md bg-bybs-pale px-3 py-3 text-sm text-bybs-muted">
        No attachment was uploaded for this submission.
      </p>
    );
  }

  const kind = attachmentKind(url);

  if (kind === "image") {
    return (
      <a href={url} rel="noreferrer" target="_blank">
        <img alt="Submitted attachment" className="max-h-80 w-full rounded-md border border-bybs-border object-contain" src={url} />
      </a>
    );
  }

  if (kind === "pdf" || kind === "document") {
    return (
      <div className="space-y-2">
        <iframe className="h-80 w-full rounded-md border border-bybs-border" src={url} title="Submitted attachment preview" />
        <Button as="a" href={url} icon={ExternalLink} rel="noreferrer" size="sm" target="_blank" variant="secondary">
          Open attachment
        </Button>
      </div>
    );
  }

  return (
    <Button as="a" href={url} icon={ExternalLink} rel="noreferrer" target="_blank" variant="secondary">
      Open submitted file
    </Button>
  );
}

export function ReviewsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modules, setModules] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [selectedModuleId, setSelectedModuleId] = useState(searchParams.get("module") || "");
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [form, setForm] = useState(() => initialReviewForm());
  const [messageForm, setMessageForm] = useState(() => initialMessageForm());
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isLoadingModules, setIsLoadingModules] = useState(true);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const currentUserId = idFor(user);

  const reviewModules = useMemo(() => {
    const assignedModules = modules.filter((module) => idFor(module.assignedMentor) === currentUserId);
    return currentUserId ? assignedModules : modules;
  }, [currentUserId, modules]);

  const selectedModule = useMemo(
    () => reviewModules.find((module) => module._id === selectedModuleId),
    [reviewModules, selectedModuleId]
  );

  useEffect(() => {
    let isMounted = true;

    mentorApi
      .listModules()
      .then((response) => {
        if (!isMounted) return;
        setModules(response.data);

        const requestedModuleId = searchParams.get("module");
        if (requestedModuleId && response.data.some((module) => module._id === requestedModuleId)) {
          setSelectedModuleId(requestedModuleId);
        }
      })
      .catch((requestError) => {
        if (isMounted) setError(requestError.message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingModules(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function loadSubmissions(moduleId = selectedModuleId) {
    if (!moduleId) {
      setSubmissions([]);
      return;
    }

    setIsLoadingSubmissions(true);
    try {
      const response = await mentorApi.listSubmissions({ module: moduleId, status });
      setSubmissions(response.data);
    } finally {
      setIsLoadingSubmissions(false);
    }
  }

  useEffect(() => {
    if (!selectedModuleId) {
      setSubmissions([]);
      return;
    }

    loadSubmissions(selectedModuleId).catch((requestError) => setError(requestError.message));
  }, [selectedModuleId, status]);

  function selectModule(module) {
    const nextSearchParams = { module: module._id };
    if (status) nextSearchParams.status = status;
    setSelectedModuleId(module._id);
    setSelectedSubmission(null);
    setFeedback("");
    setError("");
    setSearchParams(nextSearchParams);
  }

  function updateStatusFilter(value) {
    setStatus(value);
    const nextSearchParams = selectedModuleId ? { module: selectedModuleId } : {};
    if (value) nextSearchParams.status = value;
    setSearchParams(nextSearchParams);
  }

  function startReview(submission) {
    setSelectedSubmission(submission);
    setForm(initialReviewForm(submission));
    setMessageForm(initialMessageForm(submission));
    setError("");
    setFeedback("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelReview() {
    setSelectedSubmission(null);
    setForm(initialReviewForm());
    setMessageForm(initialMessageForm());
  }

  function updateReviewStatus(value) {
    setForm((current) => ({
      ...current,
      status: value,
      score: value === "approved" ? current.score : ""
    }));
  }

  async function submitReview(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      const payload = {
        feedback: form.feedback,
        status: form.status
      };

      if (form.status === "approved") {
        payload.score = form.score === "" ? undefined : Number(form.score);
      }

      await mentorApi.reviewSubmission(selectedSubmission._id, payload);
      setFeedback("Review saved.");
      cancelReview();
      await loadSubmissions();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function sendPrivateMessage(event) {
    event.preventDefault();
    const studentId = selectedSubmission?.student?._id || selectedSubmission?.student?.id;
    if (!studentId) return;

    setError("");
    setFeedback("");
    setIsSendingMessage(true);

    try {
      await mentorApi.sendStudentMessage(studentId, messageForm);
      setMessageForm(initialMessageForm(selectedSubmission));
      setFeedback("Private message sent to the mentee.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSendingMessage(false);
    }
  }

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-6">
      <PageHeader
        description="Choose an assigned module first, then review only the submissions for that module."
        title="Review submissions"
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      {selectedSubmission ? (
        <div className="min-w-0 max-w-full overflow-hidden space-y-4">
          <Card>
            <form className="grid min-w-0 max-w-full gap-4 overflow-hidden lg:grid-cols-3" onSubmit={submitReview}>
              <div className="min-w-0 lg:col-span-3">
                <p className="text-sm font-semibold uppercase text-bybs-blue">Reviewing submission</p>
                <h2 className="mt-1 text-lg font-semibold text-bybs-navy">{selectedSubmission.assignment?.title || "Assignment"}</h2>
                <p className="mt-1 text-sm text-bybs-body">
                  {selectedSubmission.student?.name || "Mentee"} · {selectedSubmission.assignment?.module?.title || "General module"}
                </p>
              </div>

              <div className="min-w-0 space-y-3 lg:col-span-3">
                <h3 className="text-sm font-semibold text-bybs-navy">Assignment brief</h3>
                <SafeHtml className={contentClassName} html={renderInstructionsHtml(selectedSubmission.assignment?.instructions)} />
              </div>

              <div className="min-w-0 space-y-3 lg:col-span-3">
                <h3 className="text-sm font-semibold text-bybs-navy">Mentee written response</h3>
                {selectedSubmission.writtenResponse ? (
                  <SafeHtml className={contentClassName} html={selectedSubmission.writtenResponse} />
                ) : (
                  <p className="rounded-md bg-bybs-pale px-3 py-3 text-sm text-bybs-muted">No written response was submitted.</p>
                )}
              </div>

              <div className="min-w-0 space-y-3 lg:col-span-3">
                <h3 className="text-sm font-semibold text-bybs-navy">Attachment preview</h3>
                <AttachmentPreview url={selectedSubmission.fileUrl} />
              </div>

              <FormField label="Review status">
                <select className={inputClassName} onChange={(event) => updateReviewStatus(event.target.value)} value={form.status}>
                  {reviewStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </FormField>
              <FormField label={`Score${selectedSubmission.assignment?.maxScore ? ` / ${selectedSubmission.assignment.maxScore}` : ""}`}>
                <input
                  className={inputClassName}
                  disabled={form.status !== "approved"}
                  max={selectedSubmission.assignment?.maxScore || 1000}
                  min="0"
                  onChange={(event) => setForm((current) => ({ ...current, score: event.target.value }))}
                  required={form.status === "approved"}
                  type="number"
                  value={form.score}
                />
              </FormField>
              <div className="min-w-0 lg:col-span-3">
                <FormField label="Feedback">
                  <RichTextEditor
                    id="review-feedback"
                    minHeightClassName="min-h-36"
                    onChange={(value) => setForm((current) => ({ ...current, feedback: value }))}
                    placeholder="Add practical feedback, encouragement, and any required changes."
                    value={form.feedback}
                  />
                </FormField>
              </div>
              <div className="flex min-w-0 flex-wrap gap-2 lg:col-span-3">
                <Button disabled={isSubmitting} icon={Save} type="submit">{isSubmitting ? "Saving..." : "Save review"}</Button>
                <Button icon={X} onClick={cancelReview} type="button" variant="secondary">Cancel</Button>
              </div>
            </form>
          </Card>

          <Card>
            <form className="grid min-w-0 max-w-full gap-4 overflow-hidden lg:grid-cols-3" onSubmit={sendPrivateMessage}>
              <div className="min-w-0 lg:col-span-3">
                <p className="text-sm font-semibold text-bybs-navy">Private message</p>
                <p className="mt-1 text-sm text-bybs-body">Send a private follow-up to this mentee without leaving the review.</p>
              </div>
              <FormField label="Message title">
                <input
                  className={inputClassName}
                  onChange={(event) => setMessageForm((current) => ({ ...current, title: event.target.value }))}
                  required
                  value={messageForm.title}
                />
              </FormField>
              <div className="min-w-0 lg:col-span-3">
                <FormField label="Message">
                  <RichTextEditor
                    id="review-private-message"
                    minHeightClassName="min-h-32"
                    onChange={(value) => setMessageForm((current) => ({ ...current, message: value }))}
                    placeholder="Write a private note, encouragement, or clarification request."
                    value={messageForm.message}
                  />
                </FormField>
              </div>
              <div className="min-w-0 lg:col-span-3">
                <Button disabled={isSendingMessage} icon={MessageSquare} type="submit">
                  {isSendingMessage ? "Sending..." : "Send private message"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      <Card>
        <SectionHeader
          description="Open a module to review submitted, pending, and late work under that module."
          title="Assigned modules"
        />
        {isLoadingModules ? (
          <div className="rounded-lg border border-bybs-border bg-white p-8 text-center text-sm text-bybs-muted">
            Loading modules...
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "title", header: "Module" },
              { key: "cohort", header: "Cohort", render: (row) => row.cohort?.title || "Cohort" },
              { key: "dates", header: "Dates", render: (row) => moduleDates(row) },
              { key: "assignments", header: "Assignments", render: (row) => moduleStats(row).assignments },
              { key: "submitted", header: "Submitted", render: (row) => moduleStats(row).submitted },
              { key: "pending", header: "Pending", render: (row) => moduleStats(row).pending },
              { key: "late", header: "Late", render: (row) => moduleStats(row).late },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
              {
                key: "actions",
                header: "Actions",
                render: (row) => (
                  <Button icon={Eye} onClick={() => selectModule(row)} size="sm" type="button" variant={row._id === selectedModuleId ? "primary" : "secondary"}>
                    View
                  </Button>
                )
              }
            ]}
            emptyDescription="Modules assigned by Admin will appear here before you review submissions."
            emptyTitle="No assigned modules"
            rows={reviewModules}
          />
        )}
      </Card>

      {selectedModule ? (
        <Card>
          <SectionHeader
            action={
              <select className={`${inputClassName} max-w-56`} onChange={(event) => updateStatusFilter(event.target.value)} value={status}>
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            }
            description={`${selectedModule.cohort?.title || "Cohort"} · ${moduleDates(selectedModule)}`}
            title={`${selectedModule.title} submissions`}
          />
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            {[
              ["Assignments", moduleStats(selectedModule).assignments],
              ["Submitted", moduleStats(selectedModule).submitted],
              ["Pending", moduleStats(selectedModule).pending],
              ["Late", moduleStats(selectedModule).late]
            ].map(([label, value]) => (
              <div className="rounded-md border border-bybs-border bg-white px-3 py-2" key={label}>
                <p className="text-xs font-medium text-bybs-muted">{label}</p>
                <p className="mt-1 text-lg font-semibold text-bybs-navy">{value || 0}</p>
              </div>
            ))}
          </div>
          {isLoadingSubmissions ? (
            <div className="rounded-lg border border-bybs-border bg-white p-8 text-center text-sm text-bybs-muted">
              Loading submissions...
            </div>
          ) : (
            <DataTable
              columns={[
                { key: "student", header: "Mentee", render: (row) => row.student?.name || "Mentee" },
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
              emptyDescription="Submitted assignments for this module will appear here once mentees upload work."
              emptyTitle="No submissions in this module"
              rows={submissions}
            />
          )}
        </Card>
      ) : (
        <EmptyState
          description="Open an assigned module above to see only that module's submissions."
          icon={BookOpen}
          title="Choose a module to review"
        />
      )}
    </div>
  );
}
