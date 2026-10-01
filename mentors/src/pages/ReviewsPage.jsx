import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  MessageSquare,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  RESOURCE_UPLOAD_ACCEPT,
  RichTextEditor,
  SafeHtml,
  SectionHeader,
  StatusBadge,
  downloadFileUrl,
  isUploadedFileUrl,
  normalizeFileUrl,
  validateResourceFile
} from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { FormField, inputClassName } from "../components/FormField.jsx";
import { apiBaseUrl, mentorApi } from "../services/api.js";
import { formatDate, formatDateTime } from "../utils/format.js";

const statusOptions = [
  { value: "", label: "All submissions" },
  { value: "pendingReview", label: "Pending review" },
  { value: "draftSaved", label: "Draft saved" },
  { value: "submitted", label: "Submitted" },
  { value: "resubmitted", label: "Resubmitted" },
  { value: "lateSubmission", label: "Late submissions" },
  { value: "needsRevision", label: "Needs revision" },
  { value: "reviewed", label: "Reviewed" },
  { value: "approved", label: "Approved" }
];

const reviewStatuses = [
  { value: "reviewed", label: "Publish feedback only" },
  { value: "needsRevision", label: "Request revision" },
  { value: "approved", label: "Approve and grade" }
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
  const draft = submission?.reviewDraft;

  return {
    score: draft?.score ?? submission?.score ?? "",
    feedback: draft?.feedback ?? submission?.feedback ?? "",
    feedbackFileUrl: draft?.feedbackFileUrl ?? submission?.feedbackFileUrl ?? "",
    status: draft?.status || (submission?.status === "approved" ? "approved" : submission?.status === "needsRevision" ? "needsRevision" : "reviewed")
  };
}

function meaningfulRichText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

function elapsedTimeLabel(value, prefix = "Waiting", endValue = Date.now()) {
  const timestamp = new Date(value).getTime();
  const endTimestamp = new Date(endValue).getTime();
  if (!Number.isFinite(timestamp) || !Number.isFinite(endTimestamp)) return "Time unavailable";

  const elapsedMinutes = Math.max(0, Math.floor((endTimestamp - timestamp) / 60000));
  if (elapsedMinutes < 60) return `${prefix} ${Math.max(elapsedMinutes, 1)} min`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${prefix} ${elapsedHours} hr${elapsedHours === 1 ? "" : "s"}`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${prefix} ${elapsedDays} day${elapsedDays === 1 ? "" : "s"}`;
}

function publishActionLabel(status) {
  if (status === "approved") return "Publish grade";
  if (status === "needsRevision") return "Request revision";
  return "Publish feedback";
}

function publishedReview(status) {
  return ["reviewed", "needsRevision", "approved"].includes(status);
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
  const attachmentUrl = normalizeFileUrl(url, apiBaseUrl);
  const attachmentDownloadUrl = downloadFileUrl(url, apiBaseUrl);
  const canDownload = isUploadedFileUrl(url);

  if (!attachmentUrl) {
    return (
      <p className="rounded-md bg-bybs-pale px-3 py-3 text-sm text-bybs-muted">
        No attachment was uploaded for this submission.
      </p>
    );
  }

  const kind = attachmentKind(attachmentUrl);

  if (kind === "image") {
    return (
      <div className="space-y-2">
        <a href={attachmentUrl} rel="noreferrer" target="_blank">
          <img alt="Submitted attachment" className="max-h-80 w-full rounded-md border border-bybs-border object-contain" src={attachmentUrl} />
        </a>
        <div className="flex flex-wrap gap-2">
          <Button as="a" href={attachmentUrl} icon={ExternalLink} rel="noreferrer" size="sm" target="_blank" variant="secondary">
            Open attachment
          </Button>
          {canDownload ? (
            <Button as="a" download href={attachmentDownloadUrl} icon={Download} rel="noreferrer" size="sm" variant="secondary">
              Download
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (kind === "pdf" || kind === "document") {
    return (
      <div className="space-y-2">
        <iframe className="h-80 w-full rounded-md border border-bybs-border" src={attachmentUrl} title="Submitted attachment preview" />
        <div className="flex flex-wrap gap-2">
          <Button as="a" href={attachmentUrl} icon={ExternalLink} rel="noreferrer" size="sm" target="_blank" variant="secondary">
            Open attachment
          </Button>
          {canDownload ? (
            <Button as="a" download href={attachmentDownloadUrl} icon={Download} rel="noreferrer" size="sm" variant="secondary">
              Download
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button as="a" href={attachmentUrl} icon={ExternalLink} rel="noreferrer" target="_blank" variant="secondary">
        Open submitted file
      </Button>
      {canDownload ? (
        <Button as="a" download href={attachmentDownloadUrl} icon={Download} rel="noreferrer" variant="secondary">
          Download
        </Button>
      ) : null}
    </div>
  );
}

export function ReviewsPage() {
  const { user } = useAuth();
  const feedbackFileInputRef = useRef(null);
  const submissionRequestRef = useRef(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSubmissionId = searchParams.get("submission") || "";
  const deepLinkSubmissionOpenedRef = useRef(false);
  const [modules, setModules] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [studentFilter, setStudentFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const [submittedFrom, setSubmittedFrom] = useState("");
  const [submittedTo, setSubmittedTo] = useState("");
  const [sort, setSort] = useState("oldest");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [filterOptions, setFilterOptions] = useState({ students: [], assignments: [] });
  const [moduleSearch, setModuleSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState(searchParams.get("module") || "");
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [form, setForm] = useState(() => initialReviewForm());
  const [messageForm, setMessageForm] = useState(() => initialMessageForm());
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isLoadingModules, setIsLoadingModules] = useState(true);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isDeletingDraft, setIsDeletingDraft] = useState(false);
  const [isUploadingFeedback, setIsUploadingFeedback] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const currentUserId = idFor(user);

  const assignedReviewModules = useMemo(() => {
    const assignedModules = modules.filter((module) => idFor(module.assignedMentor) === currentUserId);
    return currentUserId ? assignedModules : modules;
  }, [currentUserId, modules]);

  const cohortOptions = useMemo(() => {
    const cohorts = new Map();
    assignedReviewModules.forEach((module) => {
      const cohortId = idFor(module.cohort);
      if (cohortId) cohorts.set(cohortId, module.cohort?.title || "Cohort");
    });
    return [...cohorts.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [assignedReviewModules]);

  const reviewModules = useMemo(() => {
    const search = moduleSearch.trim().toLowerCase();
    return assignedReviewModules.filter((module) => {
      const matchesCohort = !cohortFilter || idFor(module.cohort) === cohortFilter;
      const matchesSearch = !search || `${module.title} ${module.cohort?.title || ""}`.toLowerCase().includes(search);
      return matchesCohort && matchesSearch;
    });
  }, [assignedReviewModules, cohortFilter, moduleSearch]);

  const selectedModule = useMemo(
    () => assignedReviewModules.find((module) => module._id === selectedModuleId),
    [assignedReviewModules, selectedModuleId]
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

  async function loadSubmissions(moduleId = selectedModuleId, requestedPage = page) {
    if (!moduleId) {
      setSubmissions([]);
      return;
    }

    const requestId = submissionRequestRef.current + 1;
    submissionRequestRef.current = requestId;
    setIsLoadingSubmissions(true);
    try {
      const response = await mentorApi.listSubmissions({
        module: moduleId,
        submission: requestedSubmissionId || undefined,
        status,
        student: studentFilter,
        assignment: assignmentFilter,
        submittedFrom,
        submittedTo,
        sort,
        page: requestedPage,
        limit: 25
      });

      if (requestId !== submissionRequestRef.current) return;
      if (response.meta?.pages && requestedPage > response.meta.pages) {
        setPage(response.meta.pages);
        return;
      }

      setSubmissions(response.data);
      setPagination(response.meta || { total: response.data.length, page: requestedPage, pages: 1 });
      setFilterOptions(response.meta?.filters || { students: [], assignments: [] });

      if (requestedSubmissionId && !deepLinkSubmissionOpenedRef.current) {
        const requestedSubmission = response.data.find((submission) => submission._id === requestedSubmissionId);
        if (requestedSubmission) {
          deepLinkSubmissionOpenedRef.current = true;
          setSelectedSubmission(requestedSubmission);
          setForm(initialReviewForm(requestedSubmission));
          setMessageForm(initialMessageForm(requestedSubmission));
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    } finally {
      if (requestId === submissionRequestRef.current) setIsLoadingSubmissions(false);
    }
  }

  useEffect(() => {
    if (!selectedModuleId) {
      setSubmissions([]);
      return;
    }

    loadSubmissions(selectedModuleId, page).catch((requestError) => setError(requestError.message));
  }, [assignmentFilter, page, requestedSubmissionId, selectedModuleId, sort, status, studentFilter, submittedFrom, submittedTo]);

  function selectModule(module) {
    const nextSearchParams = { module: module._id };
    if (status) nextSearchParams.status = status;
    setSelectedModuleId(module._id);
    setSelectedSubmission(null);
    setPage(1);
    setStudentFilter("");
    setAssignmentFilter("");
    setSubmittedFrom("");
    setSubmittedTo("");
    setFeedback("");
    setError("");
    setSearchParams(nextSearchParams);
  }

  function updateStatusFilter(value) {
    setStatus(value);
    setPage(1);
    const nextSearchParams = selectedModuleId ? { module: selectedModuleId } : {};
    if (value) nextSearchParams.status = value;
    setSearchParams(nextSearchParams);
  }

  function clearQueueFilters() {
    setStatus("");
    setStudentFilter("");
    setAssignmentFilter("");
    setSubmittedFrom("");
    setSubmittedTo("");
    setSort("oldest");
    setPage(1);
    setSearchParams(selectedModuleId ? { module: selectedModuleId } : {});
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

  function reviewPayload() {
    const payload = {
      feedback: form.feedback,
      feedbackFileUrl: form.feedbackFileUrl || undefined,
      status: form.status
    };

    if (form.status === "approved" && form.score !== "") {
      payload.score = Number(form.score);
    }

    return payload;
  }

  function updateSubmissionInQueue(updatedSubmission) {
    setSubmissions((current) => current.map((submission) => (
      submission._id === updatedSubmission._id ? updatedSubmission : submission
    )));
  }

  async function uploadFeedbackFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateResourceFile(file);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }

    setError("");
    setFeedback("Compressing and uploading the feedback attachment...");
    setIsUploadingFeedback(true);

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await mentorApi.uploadReviewFile(body);
      setForm((current) => ({ ...current, feedbackFileUrl: response.data.url }));
      setFeedback(`${response.data.originalName || "Feedback attachment"} is ready. Save the draft or publish the review to keep it.`);
    } catch (requestError) {
      setError(requestError.message);
      setFeedback("");
    } finally {
      setIsUploadingFeedback(false);
      event.target.value = "";
    }
  }

  async function saveReviewDraft() {
    if (!selectedSubmission) return;

    setError("");
    setFeedback("");
    setIsSavingDraft(true);

    try {
      const response = await mentorApi.saveReviewDraft(selectedSubmission._id, reviewPayload());
      setSelectedSubmission(response.data);
      updateSubmissionInQueue(response.data);
      setFeedback("Private draft saved. The mentee has not been notified and their score has not changed.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function deleteReviewDraft() {
    if (!selectedSubmission?.reviewDraft) return;
    if (!window.confirm("Discard this private review draft? Published feedback will not be changed.")) return;

    setError("");
    setFeedback("");
    setIsDeletingDraft(true);

    try {
      const response = await mentorApi.deleteReviewDraft(selectedSubmission._id);
      setSelectedSubmission(response.data);
      setForm(initialReviewForm(response.data));
      updateSubmissionInQueue(response.data);
      setFeedback("Private review draft discarded.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsDeletingDraft(false);
    }
  }

  async function submitReview(event) {
    event.preventDefault();

    if (!meaningfulRichText(form.feedback)) {
      setError("Add clear feedback before publishing this review.");
      return;
    }

    if (form.status === "approved" && form.score === "") {
      setError("Enter a score before publishing this grade.");
      return;
    }

    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      await mentorApi.reviewSubmission(selectedSubmission._id, reviewPayload());
      setFeedback(`${publishActionLabel(form.status)} completed. The mentee has been notified.`);
      cancelReview();
      await loadSubmissions(selectedModuleId, page);
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
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-bybs-muted">
                  <span>Submitted {formatDateTime(selectedSubmission.submittedAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-medium text-bybs-navy">
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                    {publishedReview(selectedSubmission.status) && selectedSubmission.reviewedAt
                      ? elapsedTimeLabel(selectedSubmission.submittedAt, "Reviewed after", selectedSubmission.reviewedAt)
                      : elapsedTimeLabel(selectedSubmission.submittedAt)}
                  </span>
                </div>
              </div>

              {selectedSubmission.reviewDraft ? (
                <div className="rounded-md border border-bybs-border bg-bybs-pale p-3 text-sm text-bybs-body lg:col-span-3" role="status">
                  <p className="font-semibold text-bybs-navy">Private draft restored</p>
                  <p className="mt-1">
                    Saved {formatDateTime(selectedSubmission.reviewDraft.savedAt)}
                    {selectedSubmission.reviewDraft.savedBy?.name ? ` by ${selectedSubmission.reviewDraft.savedBy.name}` : ""}. The mentee cannot see this draft.
                  </p>
                </div>
              ) : null}

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
                <h3 className="text-sm font-semibold text-bybs-navy">Submitted link</h3>
                {selectedSubmission.linkUrl ? (
                  <Button
                    as="a"
                    href={selectedSubmission.linkUrl}
                    icon={ExternalLink}
                    rel="noreferrer"
                    target="_blank"
                    variant="secondary"
                  >
                    Open submitted link
                  </Button>
                ) : (
                  <p className="rounded-md bg-bybs-pale px-3 py-3 text-sm text-bybs-muted">No link was submitted.</p>
                )}
              </div>

              <div className="min-w-0 space-y-3 lg:col-span-3">
                <h3 className="text-sm font-semibold text-bybs-navy">Attachment preview</h3>
                <AttachmentPreview url={selectedSubmission.fileUrl} />
              </div>

              <FormField
                hint={form.status === "approved"
                  ? "A score is required and will count toward progress."
                  : form.status === "needsRevision"
                    ? "The score stays disabled until the revised work is approved."
                    : "Publish written feedback without assigning a score."}
                label="Review outcome"
              >
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
              <div className="min-w-0 space-y-3 lg:col-span-3">
                <input
                  aria-label="Upload feedback attachment"
                  accept={RESOURCE_UPLOAD_ACCEPT}
                  className="sr-only"
                  onChange={uploadFeedbackFile}
                  ref={feedbackFileInputRef}
                  type="file"
                />
                <div className="flex min-w-0 flex-wrap gap-2">
                  <Button
                    disabled={isUploadingFeedback || isSubmitting || isSavingDraft}
                    icon={Upload}
                    onClick={() => feedbackFileInputRef.current?.click()}
                    type="button"
                    variant="secondary"
                  >
                    {isUploadingFeedback ? "Uploading..." : form.feedbackFileUrl ? "Replace feedback attachment" : "Add feedback attachment"}
                  </Button>
                  {form.feedbackFileUrl ? (
                    <Button
                      icon={Trash2}
                      onClick={() => setForm((current) => ({ ...current, feedbackFileUrl: "" }))}
                      type="button"
                      variant="ghost"
                    >
                      Remove attachment
                    </Button>
                  ) : null}
                </div>
                {form.feedbackFileUrl ? <AttachmentPreview url={form.feedbackFileUrl} /> : null}
              </div>
              <p className="text-sm text-bybs-muted lg:col-span-3">
                Saving a draft is private. Publishing sends the feedback to the mentee and triggers their platform and email notification.
              </p>
              <div className="flex min-w-0 flex-wrap gap-2 lg:col-span-3">
                <Button disabled={isSubmitting || isSavingDraft || isUploadingFeedback} icon={form.status === "approved" ? CheckCircle2 : form.status === "needsRevision" ? RotateCcw : Send} type="submit">
                  {isSubmitting ? "Publishing..." : publishActionLabel(form.status)}
                </Button>
                <Button disabled={isSubmitting || isSavingDraft || isUploadingFeedback} icon={Save} onClick={saveReviewDraft} type="button" variant="secondary">
                  {isSavingDraft ? "Saving draft..." : "Save draft"}
                </Button>
                {selectedSubmission.reviewDraft ? (
                  <Button disabled={isDeletingDraft || isSubmitting || isSavingDraft} icon={Trash2} onClick={deleteReviewDraft} type="button" variant="ghost">
                    {isDeletingDraft ? "Discarding..." : "Discard draft"}
                  </Button>
                ) : null}
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
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <FormField label="Find module">
            <input
              className={inputClassName}
              onChange={(event) => setModuleSearch(event.target.value)}
              placeholder="Search module or cohort"
              type="search"
              value={moduleSearch}
            />
          </FormField>
          <FormField label="Cohort">
            <select className={inputClassName} onChange={(event) => setCohortFilter(event.target.value)} value={cohortFilter}>
              <option value="">All cohorts</option>
              {cohortOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
            </select>
          </FormField>
        </div>
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
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <FormField label="Grading status">
              <select className={inputClassName} onChange={(event) => updateStatusFilter(event.target.value)} value={status}>
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FormField>
            <FormField label="Mentee">
              <select
                className={inputClassName}
                onChange={(event) => {
                  setStudentFilter(event.target.value);
                  setPage(1);
                }}
                value={studentFilter}
              >
                <option value="">All mentees</option>
                {filterOptions.students.map((student) => <option key={student._id} value={student._id}>{student.name}</option>)}
              </select>
            </FormField>
            <FormField label="Assignment">
              <select
                className={inputClassName}
                onChange={(event) => {
                  setAssignmentFilter(event.target.value);
                  setPage(1);
                }}
                value={assignmentFilter}
              >
                <option value="">All assignments</option>
                {filterOptions.assignments.map((assignment) => <option key={assignment._id} value={assignment._id}>{assignment.title}</option>)}
              </select>
            </FormField>
            <FormField label="Submitted from">
              <input
                className={inputClassName}
                onChange={(event) => {
                  setSubmittedFrom(event.target.value);
                  setPage(1);
                }}
                type="date"
                value={submittedFrom}
              />
            </FormField>
            <FormField label="Submitted to">
              <input
                className={inputClassName}
                min={submittedFrom || undefined}
                onChange={(event) => {
                  setSubmittedTo(event.target.value);
                  setPage(1);
                }}
                type="date"
                value={submittedTo}
              />
            </FormField>
            <FormField label="Queue order">
              <select
                className={inputClassName}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
                value={sort}
              >
                <option value="oldest">Longest waiting first</option>
                <option value="newest">Newest first</option>
              </select>
            </FormField>
          </div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-bybs-muted">
              {pagination.total || 0} submission{pagination.total === 1 ? "" : "s"} match these filters.
            </p>
            <Button icon={RotateCcw} onClick={clearQueueFilters} size="sm" type="button" variant="ghost">Clear filters</Button>
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
                {
                  key: "waiting",
                  header: "Turnaround",
                  render: (row) => (
                    <span className="inline-flex items-center gap-1 text-sm text-bybs-body">
                      <Clock3 className="h-4 w-4 text-bybs-muted" aria-hidden="true" />
                      {publishedReview(row.status) && row.reviewedAt
                        ? elapsedTimeLabel(row.submittedAt, "Reviewed after", row.reviewedAt)
                        : elapsedTimeLabel(row.submittedAt)}
                    </span>
                  )
                },
                { key: "score", header: "Score", render: (row) => row.score ?? "Not scored" },
                { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
                {
                  key: "draft",
                  header: "Draft",
                  render: (row) => row.reviewDraft
                    ? <StatusBadge label="Draft saved" status="draft" />
                    : <span className="text-bybs-muted">None</span>
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (row) => (
                    <Button icon={ClipboardCheck} onClick={() => startReview(row)} size="sm" type="button" variant="secondary">
                      {row.reviewDraft ? "Continue draft" : publishedReview(row.status) ? "View or update" : "Review"}
                    </Button>
                  )
                }
              ]}
              emptyDescription="Submitted assignments for this module will appear here once mentees upload work."
              emptyTitle="No submissions in this module"
              rows={submissions}
            />
          )}
          {pagination.pages > 1 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-bybs-muted">Page {pagination.page} of {pagination.pages}</p>
              <div className="flex gap-2">
                <Button
                  disabled={page <= 1 || isLoadingSubmissions}
                  icon={ChevronLeft}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Previous
                </Button>
                <Button
                  disabled={page >= pagination.pages || isLoadingSubmissions}
                  icon={ChevronRight}
                  onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
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
