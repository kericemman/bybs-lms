import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  MessageCircleQuestion,
  RotateCcw,
  Send,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AddToCalendarButton,
  Button,
  CONTENT_TIMELINES,
  EmptyState,
  PageHeader,
  RESOURCE_UPLOAD_ACCEPT,
  RichTextEditor,
  SafeHtml,
  StatusBadge,
  downloadFileUrl,
  formatAssignmentDeadline,
  assignmentTimelineStatus,
  normalizeFileUrl,
  timelineCounts,
  validateResourceFile
} from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { AssignmentInstructions } from "../components/AssignmentInstructions.jsx";
import { apiBaseUrl, studentApi } from "../services/api.js";
import { formatDateTime, titleFor } from "../utils/format.js";

const assignmentFilters = [
  { value: "all", label: "All" },
  { value: "todo", label: "To do" },
  { value: "review", label: "Awaiting review" },
  { value: "completed", label: "Completed" }
];

const assignmentFileTypeLabels = {
  csv: "CSV",
  doc: "Word file",
  docx: "Word file",
  jpeg: "image",
  jpg: "image",
  mp4: "video",
  pdf: "PDF",
  png: "image",
  ppt: "slides",
  pptx: "slides",
  txt: "text file",
  webp: "image",
  xls: "spreadsheet",
  xlsx: "spreadsheet"
};

const statusLabels = {
  notStarted: "Not started",
  submitted: "Submitted",
  resubmitted: "Resubmitted",
  lateSubmission: "Late submission",
  reviewed: "Reviewed",
  needsRevision: "Revision requested",
  approved: "Graded"
};

const assignmentButtonClassName =
  "w-full !bg-bybs-blue !text-white shadow-sm hover:!bg-bybs-blueHover focus-visible:!ring-bybs-pale sm:w-auto";

const contentClassName =
  "text-sm leading-6 text-bybs-body [&_a]:break-words [&_a]:font-medium [&_a]:text-bybs-blue [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-bybs-rose [&_blockquote]:bg-bybs-blush [&_blockquote]:px-4 [&_blockquote]:py-2 [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-bybs-navy [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-bybs-blue [&_img]:max-w-full [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:ml-5 [&_ul]:list-disc";

function submissionStatus(assignment) {
  return assignment.submission?.status || "notStarted";
}

function statusLabel(status) {
  return statusLabels[status] || status;
}

function postedBy(assignment) {
  return assignment.createdBy?.name || "BYBS team";
}

function assignmentCalendarEvent(assignment) {
  return {
    id: assignment._id,
    title: `BYBS assignment due: ${assignment.title}`,
    description: `${titleFor(assignment.module, "General assignment")} assignment posted by ${postedBy(assignment)}. Due ${formatAssignmentDeadline(assignment.dueDate, { includeLocalTime: false })}.`,
    startsAt: assignment.dueDate
  };
}

function fileTargetLabel(value, fallback) {
  const source = String(value || "");
  const path = source.split("?")[0].split("#")[0];
  const extension = path.includes(".") ? path.split(".").pop().toLowerCase() : "";

  return assignmentFileTypeLabels[extension] || fallback;
}

function resourceButtonLabel(link, index) {
  const title = String(link?.title || "").trim();
  return title ? `Open resource: ${title}` : `Open resource ${index + 1}`;
}

function assignmentMatchesFilter(assignment, filter) {
  const status = submissionStatus(assignment);
  if (filter === "todo") return status === "notStarted" || status === "needsRevision";
  if (filter === "review") return ["submitted", "resubmitted", "lateSubmission", "reviewed"].includes(status);
  if (filter === "completed") return status === "approved";
  return true;
}

function draftStorageKey(userId, assignmentId) {
  return `bybs:assignment-draft:${userId || "mentee"}:${assignmentId}`;
}

function readDraft(userId, assignmentId) {
  try {
    const stored = window.localStorage.getItem(draftStorageKey(userId, assignmentId));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function removeDraft(userId, assignmentId) {
  try {
    window.localStorage.removeItem(draftStorageKey(userId, assignmentId));
  } catch {
    // Storage can be unavailable in private browsing; the in-memory form remains usable.
  }
}

function writeDraft(userId, assignmentId, draft) {
  try {
    window.localStorage.setItem(draftStorageKey(userId, assignmentId), JSON.stringify(draft));
  } catch {
    // Storage can be unavailable in private browsing; submission still works normally.
  }
}

function meaningfulRichText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

function scorePercentage(submission, assignment) {
  if (typeof submission?.score !== "number" || !assignment?.maxScore) return null;
  return Math.round((submission.score / assignment.maxScore) * 100);
}

function SubmissionFileActions({ file, fallbackLabel = "submitted file" }) {
  const fileUrl = file?.url || file?.fileUrl || "";
  if (!fileUrl) return null;

  const openUrl = normalizeFileUrl(fileUrl, apiBaseUrl);
  const downloadUrl = downloadFileUrl(fileUrl, apiBaseUrl);
  const label = fileTargetLabel(file?.originalName || fileUrl, fallbackLabel);

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      <Button as="a" className={assignmentButtonClassName} href={openUrl} icon={ExternalLink} rel="noreferrer" size="sm" target="_blank" variant="primary">
        View {label}
      </Button>
      <Button as="a" className={assignmentButtonClassName} download href={downloadUrl} icon={Download} rel="noreferrer" size="sm" variant="primary">
        Download {label}
      </Button>
    </div>
  );
}

function SubmissionSummary({ assignment, submission }) {
  if (!submission) return null;

  const percentage = scorePercentage(submission, assignment);

  return (
    <section className="mt-5 min-w-0 rounded-md border border-bybs-border bg-bybs-pale p-4" aria-labelledby="submission-review-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-bybs-navy" id="submission-review-title">Submission and feedback</h3>
          <p className="mt-1 text-sm text-bybs-body">
            Submitted {formatDateTime(submission.submittedAt)} · Attempt {submission.attemptNumber || 1}
          </p>
        </div>
        <StatusBadge className="self-start" label={statusLabel(submission.status)} status={submission.status} />
      </div>

      {typeof submission.score === "number" ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-medium text-bybs-muted">Score</p>
            <p className="mt-1 text-xl font-semibold text-bybs-navy">{submission.score} / {assignment.maxScore || 100}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-medium text-bybs-muted">Percentage</p>
            <p className="mt-1 text-xl font-semibold text-bybs-rose">{percentage}%</p>
          </div>
        </div>
      ) : null}

      {submission.reviewedBy || submission.reviewedAt ? (
        <p className="mt-3 text-sm text-bybs-muted">
          {submission.reviewedBy?.name ? `Reviewed by ${submission.reviewedBy.name}` : "Reviewed"}
          {submission.reviewedAt ? ` on ${formatDateTime(submission.reviewedAt)}` : ""}
        </p>
      ) : null}

      {submission.feedback ? (
        <div className="mt-4 rounded-md bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-bybs-navy">
            {submission.status === "needsRevision" ? "Revision instructions" : "Mentor feedback"}
          </p>
          <SafeHtml className={contentClassName} html={submission.feedback} />
          {submission.feedbackFileUrl ? (
            <div className="mt-3">
              <SubmissionFileActions file={{ fileUrl: submission.feedbackFileUrl }} fallbackLabel="feedback attachment" />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-bybs-muted">Mentor feedback has not been published yet.</p>
      )}
    </section>
  );
}

function AttemptHistory({ history = [] }) {
  if (!history.length) return null;

  return (
    <details className="mt-4 rounded-md border border-bybs-border bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-bybs-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bybs-pale">
        Previous attempts ({history.length})
      </summary>
      <div className="space-y-4 border-t border-bybs-border p-4">
        {[...history].reverse().map((attempt) => (
          <article className="min-w-0 rounded-md bg-bybs-pale p-4" key={attempt._id || `${attempt.attemptNumber}-${attempt.submittedAt}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-bybs-navy">Attempt {attempt.attemptNumber || 1}</p>
              <StatusBadge label={statusLabel(attempt.status)} status={attempt.status || "submitted"} />
            </div>
            <p className="mt-1 text-sm text-bybs-muted">Submitted {formatDateTime(attempt.submittedAt)}</p>
            {typeof attempt.score === "number" ? <p className="mt-2 text-sm font-semibold text-bybs-navy">Previous score: {attempt.score}</p> : null}
            {attempt.writtenResponse ? <SafeHtml className={`${contentClassName} mt-3 rounded-md bg-white p-3`} html={attempt.writtenResponse} /> : null}
            {attempt.linkUrl ? (
              <a className="mt-3 inline-flex break-all text-sm font-medium text-bybs-blue underline" href={attempt.linkUrl} rel="noreferrer" target="_blank">
                Open previous submitted link
              </a>
            ) : null}
            {attempt.fileUrl ? <div className="mt-3"><SubmissionFileActions file={{ fileUrl: attempt.fileUrl }} /></div> : null}
            {attempt.feedback ? <SafeHtml className={`${contentClassName} mt-3 rounded-md bg-white p-3`} html={attempt.feedback} /> : null}
            {attempt.feedbackFileUrl ? <div className="mt-3"><SubmissionFileActions file={{ fileUrl: attempt.feedbackFileUrl }} fallbackLabel="feedback attachment" /></div> : null}
          </article>
        ))}
      </div>
    </details>
  );
}

export function AssignmentsPage() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [assignments, setAssignments] = useState([]);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [activeFilter, setActiveFilter] = useState(() => {
    const requestedFilter = searchParams.get("filter");
    return assignmentFilters.some((filter) => filter.value === requestedFilter) ? requestedFilter : "all";
  });
  const [activeTimeline, setActiveTimeline] = useState(() => {
    const requestedTimeline = searchParams.get("view");
    return CONTENT_TIMELINES.some((timeline) => timeline.value === requestedTimeline) ? requestedTimeline : "current";
  });
  const [writtenResponse, setWrittenResponse] = useState("");
  const [submissionLink, setSubmissionLink] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [draftNotice, setDraftNotice] = useState("");
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userId = user?.id || user?._id || "mentee";

  async function loadAssignments() {
    const response = await studentApi.listAssignments();
    setAssignments(response.data);
    return response.data;
  }

  useEffect(() => {
    let isMounted = true;

    loadAssignments()
      .then((data) => {
        if (!isMounted) return;
        const requestedAssignmentId = searchParams.get("assignment");
        if (!requestedAssignmentId) return;

        const requestedAssignment = data.find((assignment) => assignment._id === requestedAssignmentId);
        if (requestedAssignment) {
          setActiveAssignment(requestedAssignment);
        } else {
          setError("This assignment is unavailable or is not assigned to your cohort.");
        }
      })
      .catch((loadError) => {
        if (isMounted) setError(loadError.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeAssignment) {
      setIsDraftReady(false);
      return;
    }

    setIsDraftReady(false);
    const submission = activeAssignment.submission;
    const localDraft = readDraft(userId, activeAssignment._id);

    setWrittenResponse(localDraft?.writtenResponse ?? submission?.writtenResponse ?? "");
    setSubmissionLink(localDraft?.submissionLink ?? submission?.linkUrl ?? "");
    setUploadedFile(localDraft?.uploadedFile ?? (submission?.fileUrl ? { url: submission.fileUrl, originalName: "Submitted file" } : null));
    setDraftNotice(localDraft ? `Draft restored from ${formatDateTime(localDraft.updatedAt)}.` : "");
    setIsDraftReady(true);
  }, [activeAssignment?._id, activeAssignment?.submission?.updatedAt, userId]);

  useEffect(() => {
    if (!activeAssignment || !isDraftReady) return;

    const submission = activeAssignment.submission;
    const matchesSavedSubmission =
      writtenResponse === (submission?.writtenResponse || "") &&
      submissionLink === (submission?.linkUrl || "") &&
      (uploadedFile?.url || "") === (submission?.fileUrl || "");
    const hasDraftContent = Boolean(meaningfulRichText(writtenResponse) || submissionLink.trim() || uploadedFile?.url);

    if (!hasDraftContent || matchesSavedSubmission) {
      removeDraft(userId, activeAssignment._id);
      return;
    }

    writeDraft(userId, activeAssignment._id, {
      writtenResponse,
      submissionLink,
      uploadedFile,
      updatedAt: new Date().toISOString()
    });
  }, [activeAssignment, isDraftReady, submissionLink, uploadedFile, userId, writtenResponse]);

  const assignmentTimelineCounts = useMemo(
    () => timelineCounts(assignments, assignmentTimelineStatus),
    [assignments]
  );
  const filteredAssignments = useMemo(
    () => assignments.filter((assignment) => (
      assignmentTimelineStatus(assignment) === activeTimeline && assignmentMatchesFilter(assignment, activeFilter)
    )),
    [activeFilter, activeTimeline, assignments]
  );

  function chooseAssignment(assignment) {
    setActiveAssignment(assignment);
    setReceipt(null);
    setFeedback("");
    setError("");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("assignment", assignment._id);
    setSearchParams(nextParams);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeAssignment() {
    setActiveAssignment(null);
    setReceipt(null);
    setDraftNotice("");
    setFeedback("");
    setError("");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("assignment");
    setSearchParams(nextParams);
  }

  function chooseFilter(filter) {
    setActiveFilter(filter);
    const nextParams = new URLSearchParams(searchParams);

    if (filter === "all") {
      nextParams.delete("filter");
    } else {
      nextParams.set("filter", filter);
    }

    setSearchParams(nextParams);
  }

  function chooseTimeline(timeline) {
    setActiveTimeline(timeline);
    const nextParams = new URLSearchParams(searchParams);

    if (timeline === "current") {
      nextParams.delete("view");
    } else {
      nextParams.set("view", timeline);
    }

    setSearchParams(nextParams);
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setFeedback("");
    const validationError = validateResourceFile(file);

    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    setFeedback("Compressing and uploading your file...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await studentApi.uploadFile(formData);
      setUploadedFile(response.data);
      setFeedback(`${response.data.originalName || "File"} is uploaded and ready to submit.`);
    } catch (uploadError) {
      setError(`${uploadError.message || "Your file could not be uploaded."} Your written response is saved on this device. Check your connection and try again.`);
      setFeedback("");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!activeAssignment) return;

    if (!meaningfulRichText(writtenResponse) && !submissionLink.trim() && !uploadedFile?.url) {
      setError("Add a written response, file, or submission link before submitting.");
      return;
    }

    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      const response = await studentApi.submitAssignment(activeAssignment._id, {
        fileUrl: uploadedFile?.url,
        linkUrl: submissionLink.trim(),
        writtenResponse
      });

      removeDraft(userId, activeAssignment._id);
      setDraftNotice("");
      setReceipt(response.data);
      setFeedback("Submission successful. Your receipt is shown above.");

      try {
        const refreshedAssignments = await loadAssignments();
        const refreshedAssignment = refreshedAssignments.find((assignment) => assignment._id === activeAssignment._id);
        if (refreshedAssignment) {
          setIsDraftReady(false);
          setActiveAssignment(refreshedAssignment);
        }
      } catch (refreshError) {
        setError(`Your assignment was submitted successfully, but the list could not refresh: ${refreshError.message}`);
      }
    } catch (submitError) {
      setError(`${submitError.message || "Your assignment could not be submitted."} Your draft is saved on this device. Check your connection and try again.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeSubmission = activeAssignment?.submission;
  const activeTemplateUrl = activeAssignment?.templateFileUrl ? normalizeFileUrl(activeAssignment.templateFileUrl, apiBaseUrl) : "";
  const activeTemplateDownloadUrl = activeAssignment?.templateFileUrl ? downloadFileUrl(activeAssignment.templateFileUrl, apiBaseUrl) : "";
  const activeTemplateLabel = fileTargetLabel(activeAssignment?.templateFileUrl, "assignment template");
  const canSubmit = activeAssignment?.status === "published" && (!activeSubmission || activeAssignment.allowResubmission);

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <PageHeader description="View instructions, submit your work, and keep a clear record of feedback and grades." title="Assignments" />

      {activeAssignment ? (
        <section className="min-w-0 max-w-full overflow-hidden rounded-lg border border-bybs-border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-bybs-blue">{titleFor(activeAssignment.module, "General assignment")}</p>
              <h2 className="mt-1 break-words text-lg font-semibold text-bybs-navy">{activeAssignment.title}</h2>
              <p className="mt-1 text-sm text-bybs-body">Due {formatAssignmentDeadline(activeAssignment.dueDate)}</p>
              <p className="mt-1 text-sm text-bybs-muted">Assigned {formatDateTime(activeAssignment.createdAt)} · Posted by {postedBy(activeAssignment)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={statusLabel(submissionStatus(activeAssignment))} status={submissionStatus(activeAssignment)} />
              <AddToCalendarButton event={assignmentCalendarEvent(activeAssignment)} fileName={`bybs-assignment-${activeAssignment._id}`} />
              <Button
                as="a"
                href={`/app/questions?assignment=${activeAssignment._id}${activeAssignment.module?._id ? `&module=${activeAssignment.module._id}` : ""}`}
                icon={MessageCircleQuestion}
                size="sm"
                variant="secondary"
              >
                Ask mentor
              </Button>
            </div>
          </div>

          {receipt ? (
            <div className="mt-5 rounded-md border border-bybs-border bg-bybs-pale p-4" role="status">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-bybs-blue" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-bybs-navy">Assignment submitted successfully</h3>
                  <p className="mt-1 text-sm text-bybs-body">Submitted {formatDateTime(receipt.submittedAt)} · Attempt {receipt.attemptNumber || 1}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge label={statusLabel(receipt.status)} status={receipt.status} />
                    {receipt.fileUrl ? <span className="text-sm text-bybs-body">File received</span> : null}
                    {receipt.linkUrl ? <span className="text-sm text-bybs-body">Link received</span> : null}
                    {receipt.writtenResponse ? <span className="text-sm text-bybs-body">Written response received</span> : null}
                  </div>
                  {receipt.fileUrl ? <div className="mt-3"><SubmissionFileActions file={{ fileUrl: receipt.fileUrl }} /></div> : null}
                  {receipt.linkUrl ? <a className="mt-3 inline-flex break-all text-sm font-medium text-bybs-blue underline" href={receipt.linkUrl} rel="noreferrer" target="_blank">Open submitted link</a> : null}
                </div>
              </div>
            </div>
          ) : null}

          <AssignmentInstructions instructions={activeAssignment.instructions} />

          {activeTemplateUrl ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button as="a" className={assignmentButtonClassName} href={activeTemplateUrl} icon={ExternalLink} rel="noreferrer" size="sm" target="_blank" variant="primary">View {activeTemplateLabel}</Button>
              <Button as="a" className={assignmentButtonClassName} download href={activeTemplateDownloadUrl} icon={Download} rel="noreferrer" size="sm" variant="primary">Download {activeTemplateLabel}</Button>
            </div>
          ) : null}

          {activeAssignment.resourceLinks?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {activeAssignment.resourceLinks.map((link, index) => (
                <Button as="a" className={assignmentButtonClassName} href={link.url} icon={ExternalLink} key={link.url} rel="noreferrer" size="sm" target="_blank" variant="primary">
                  {resourceButtonLabel(link, index)}
                </Button>
              ))}
            </div>
          ) : null}

          <SubmissionSummary assignment={activeAssignment} submission={activeSubmission} />
          <AttemptHistory history={activeSubmission?.history} />

          {canSubmit ? (
            <form className="mt-5 min-w-0 max-w-full space-y-4 overflow-hidden border-t border-bybs-border pt-5" onSubmit={handleSubmit}>
              <div>
                <h3 className="font-semibold text-bybs-navy">{activeSubmission ? "Submit an updated attempt" : "Submit your assignment"}</h3>
                <p className="mt-1 text-sm text-bybs-muted">Use a written response, an uploaded file, a link, or any combination requested in the instructions.</p>
              </div>

              {draftNotice ? (
                <p className="flex items-center gap-2 rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue" role="status">
                  <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {draftNotice}
                </p>
              ) : null}

              <label className="block min-w-0">
                <span className="text-sm font-medium text-bybs-body">Written response</span>
                <div className="mt-2 min-w-0 max-w-full">
                  <RichTextEditor id="written-response" minHeightClassName="min-h-36" onChange={setWrittenResponse} placeholder="Write your reflection, notes, or assignment answer here." value={writtenResponse} />
                </div>
              </label>

              <div>
                <input aria-label="Upload assignment file" accept={RESOURCE_UPLOAD_ACCEPT} className="sr-only" onChange={handleUpload} ref={fileInputRef} type="file" />
                <Button className={assignmentButtonClassName} disabled={isUploading || isSubmitting} icon={Upload} onClick={() => fileInputRef.current?.click()} type="button" variant="primary">
                  {isUploading ? "Compressing and uploading..." : uploadedFile ? "Replace file" : "Upload file"}
                </Button>
                <p className="mt-2 text-xs text-bybs-muted">Supported: PDF, Word, PowerPoint, Excel, CSV, text, image, or MP4. Maximum size: 50 MB.</p>
                {uploadedFile ? (
                  <div className="mt-3 min-w-0 space-y-2">
                    <p className="flex min-w-0 items-center gap-2 text-sm text-bybs-body">
                      <FileCheck2 className="h-4 w-4 shrink-0 text-bybs-blue" aria-hidden="true" />
                      <span className="min-w-0 truncate">{uploadedFile.originalName || "Submitted file"}</span>
                    </p>
                    <SubmissionFileActions file={uploadedFile} />
                  </div>
                ) : null}
              </div>

              <label className="block min-w-0">
                <span className="text-sm font-medium text-bybs-body">Submission link</span>
                <input
                  className="mt-2 h-11 w-full rounded-md border border-bybs-border px-3 text-base outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale sm:text-sm"
                  onChange={(event) => setSubmissionLink(event.target.value)}
                  placeholder="https://docs.google.com/..."
                  type="url"
                  value={submissionLink}
                />
                <span className="mt-1 block text-xs text-bybs-muted">Use this for Google Docs, Canva, YouTube, or another online submission.</span>
              </label>

              {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose" role="alert">{error}</p> : null}
              {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue" aria-live="polite">{feedback}</p> : null}

              <div className="flex min-w-0 flex-wrap gap-2">
                <Button disabled={isSubmitting || isUploading} icon={Send} type="submit">{isSubmitting ? "Submitting..." : activeSubmission ? "Submit updated attempt" : "Submit assignment"}</Button>
                <Button onClick={closeAssignment} type="button" variant="secondary">Back to assignments</Button>
              </div>
            </form>
          ) : (
            <div className="mt-5 rounded-md bg-bybs-pale p-4 text-sm text-bybs-body">
              {activeAssignment.status !== "published" ? "This assignment is closed and is not accepting new submissions." : "Your submission is recorded and this assignment does not allow another attempt."}
              <div className="mt-3"><Button onClick={closeAssignment} size="sm" type="button" variant="secondary">Back to assignments</Button></div>
            </div>
          )}
        </section>
      ) : null}

      {!activeAssignment ? (
        <>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-bybs-muted">Learning stage</p>
              <div aria-label="Assignment learning stage" className="flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist">
                {CONTENT_TIMELINES.map((timeline) => (
                  <button
                    aria-selected={activeTimeline === timeline.value}
                    className={`h-10 shrink-0 rounded-md px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bybs-blue focus-visible:ring-offset-2 ${activeTimeline === timeline.value ? "bg-bybs-blue text-white" : "border border-bybs-border bg-white text-bybs-body hover:bg-bybs-pale hover:text-bybs-blue"}`}
                    key={timeline.value}
                    onClick={() => chooseTimeline(timeline.value)}
                    role="tab"
                    type="button"
                  >
                    {timeline.label} ({assignmentTimelineCounts[timeline.value]})
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-bybs-muted">Submission status</p>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="Assignment submission status" role="group">
                {assignmentFilters.map((filter) => (
                  <button
                    aria-pressed={activeFilter === filter.value}
                    className={`h-10 shrink-0 rounded-md px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bybs-pale ${activeFilter === filter.value ? "bg-bybs-blue text-white" : "border border-bybs-border bg-white text-bybs-body hover:bg-bybs-pale hover:text-bybs-blue"}`}
                    key={filter.value}
                    onClick={() => chooseFilter(filter.value)}
                    type="button"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose" role="alert">{error}</p> : null}

          {isLoading ? (
            <div className="flex items-center gap-2 rounded-md border border-bybs-border bg-white p-4 text-sm text-bybs-muted" role="status">
              <Clock3 className="h-4 w-4 animate-pulse" aria-hidden="true" />
              Loading assignments...
            </div>
          ) : !assignments.length ? (
            <EmptyState description="Your next assignments will appear here once they are published." icon={ClipboardList} title="No assignments yet" />
          ) : !filteredAssignments.length ? (
            <EmptyState description={`There are no ${activeTimeline} assignments matching this submission status.`} icon={ClipboardList} title="Nothing here" />
          ) : (
            <div className="grid min-w-0 max-w-full gap-4 overflow-hidden xl:grid-cols-2">
              {filteredAssignments.map((assignment) => {
                const submission = assignment.submission;
                const percentage = scorePercentage(submission, assignment);

                return (
                  <article className="min-w-0 max-w-full overflow-hidden rounded-lg border border-bybs-border bg-white p-4 shadow-sm" key={assignment._id}>
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-bybs-blue">{titleFor(assignment.module, "General assignment")}</p>
                        <h2 className="mt-1 break-words text-base font-semibold text-bybs-navy">{assignment.title}</h2>
                        <p className="mt-1 text-sm text-bybs-body">Due {formatAssignmentDeadline(assignment.dueDate)}</p>
                        <p className="mt-1 text-xs text-bybs-muted">Assigned {formatDateTime(assignment.createdAt)} · {postedBy(assignment)}</p>
                      </div>
                      <StatusBadge label={statusLabel(submissionStatus(assignment))} status={submissionStatus(assignment)} />
                    </div>

                    {submission ? (
                      <div className="mt-3 rounded-md bg-bybs-pale p-3 text-sm text-bybs-body">
                        <p>Submitted {formatDateTime(submission.submittedAt)} · Attempt {submission.attemptNumber || 1}</p>
                        {typeof submission.score === "number" ? (
                          <p className="mt-1 font-semibold text-bybs-navy">Score: {submission.score} / {assignment.maxScore || 100} ({percentage}%)</p>
                        ) : (
                          <p className="mt-1 text-bybs-muted">{submission.feedback ? "Feedback is available." : "Awaiting mentor feedback."}</p>
                        )}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button className={assignmentButtonClassName} onClick={() => chooseAssignment(assignment)} size="sm" type="button">{submission ? "Open submission and feedback" : "Open assignment"}</Button>
                      <Button as="a" href={`/app/questions?assignment=${assignment._id}${assignment.module?._id ? `&module=${assignment.module._id}` : ""}`} icon={MessageCircleQuestion} size="sm" variant="secondary">Ask mentor</Button>
                      <AddToCalendarButton event={assignmentCalendarEvent(assignment)} fileName={`bybs-assignment-${assignment._id}`} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
