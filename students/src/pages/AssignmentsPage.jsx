import { ClipboardList, Download, ExternalLink, Send, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AddToCalendarButton,
  Button,
  EmptyState,
  PageHeader,
  RESOURCE_UPLOAD_ACCEPT,
  RichTextEditor,
  SafeHtml,
  StatusBadge,
  downloadFileUrl,
  normalizeFileUrl,
  validateResourceFile
} from "@bybs/shared";
import { AssignmentInstructions } from "../components/AssignmentInstructions.jsx";
import { apiBaseUrl, studentApi } from "../services/api.js";
import { formatDate, titleFor } from "../utils/format.js";

function submissionStatus(assignment) {
  return assignment.submission?.status || "notStarted";
}

function postedBy(assignment) {
  return assignment.createdBy?.name || "BYBS team";
}

function assignmentCalendarEvent(assignment) {
  return {
    allDay: true,
    id: assignment._id,
    title: `BYBS assignment due: ${assignment.title}`,
    description: `${titleFor(assignment.module, "General assignment")} assignment posted by ${postedBy(assignment)}.`,
    startsAt: assignment.dueDate
  };
}

const assignmentButtonClassName =
  "w-full !bg-bybs-blue !text-white shadow-sm hover:!bg-bybs-blueHover focus-visible:!ring-bybs-pale sm:w-auto";

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

export function AssignmentsPage() {
  const fileInputRef = useRef(null);
  const [assignments, setAssignments] = useState([]);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [writtenResponse, setWrittenResponse] = useState("");
  const [submissionLink, setSubmissionLink] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadAssignments() {
    const response = await studentApi.listAssignments();
    setAssignments(response.data);
  }

  useEffect(() => {
    loadAssignments().catch((loadError) => setError(loadError.message));
  }, []);

  function chooseAssignment(assignment) {
    setActiveAssignment(assignment);
    setWrittenResponse(assignment.submission?.writtenResponse || "");
    setSubmissionLink(assignment.submission?.linkUrl || "");
    setUploadedFile(assignment.submission?.fileUrl ? { url: assignment.submission.fileUrl, originalName: "Submitted file" } : null);
    setFeedback("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
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

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await studentApi.uploadFile(formData);
      setUploadedFile(response.data);
      setFeedback(`${response.data.originalName || "File"} uploaded.`);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!activeAssignment) return;

    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      await studentApi.submitAssignment(activeAssignment._id, {
        fileUrl: uploadedFile?.url,
        linkUrl: submissionLink.trim(),
        writtenResponse
      });
      setFeedback("Assignment submitted.");
      setActiveAssignment(null);
      setUploadedFile(null);
      setSubmissionLink("");
      setWrittenResponse("");
      await loadAssignments();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeTemplateUrl = activeAssignment?.templateFileUrl
    ? normalizeFileUrl(activeAssignment.templateFileUrl, apiBaseUrl)
    : "";
  const activeTemplateDownloadUrl = activeAssignment?.templateFileUrl
    ? downloadFileUrl(activeAssignment.templateFileUrl, apiBaseUrl)
    : "";
  const uploadedFileUrl = uploadedFile?.url ? normalizeFileUrl(uploadedFile.url, apiBaseUrl) : "";
  const uploadedFileDownloadUrl = uploadedFile?.url ? downloadFileUrl(uploadedFile.url, apiBaseUrl) : "";
  const activeTemplateLabel = fileTargetLabel(activeAssignment?.templateFileUrl, "assignment template");
  const uploadedFileLabel = fileTargetLabel(uploadedFile?.originalName || uploadedFile?.url, "submitted file");

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-6">
      <PageHeader
        description="View instructions, download templates, upload files, and read mentor feedback."
        title="Assignments"
      />

      {activeAssignment ? (
        <section className="min-w-0 max-w-full overflow-hidden rounded-lg border border-bybs-border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-bybs-blue">{titleFor(activeAssignment.module, "General assignment")}</p>
              <h2 className="mt-1 text-lg font-semibold text-bybs-navy">{activeAssignment.title}</h2>
              <p className="mt-1 text-sm text-bybs-body">
                Due {formatDate(activeAssignment.dueDate)} · Posted by {postedBy(activeAssignment)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={submissionStatus(activeAssignment)} />
              <AddToCalendarButton event={assignmentCalendarEvent(activeAssignment)} fileName={`bybs-assignment-${activeAssignment._id}`} />
            </div>
          </div>

          <AssignmentInstructions instructions={activeAssignment.instructions} />

          {activeTemplateUrl ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                as="a"
                className={assignmentButtonClassName}
                href={activeTemplateUrl}
                icon={ExternalLink}
                rel="noreferrer"
                size="sm"
                target="_blank"
                variant="primary"
              >
                View {activeTemplateLabel}
              </Button>
              <Button
                as="a"
                className={assignmentButtonClassName}
                download
                href={activeTemplateDownloadUrl}
                icon={Download}
                rel="noreferrer"
                size="sm"
                variant="primary"
              >
                Download {activeTemplateLabel}
              </Button>
            </div>
          ) : null}

          {activeAssignment.resourceLinks?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {activeAssignment.resourceLinks.map((link, index) => (
                <Button
                  as="a"
                  className={assignmentButtonClassName}
                  href={link.url}
                  icon={ExternalLink}
                  key={link.url}
                  rel="noreferrer"
                  size="sm"
                  target="_blank"
                  variant="primary"
                >
                  {resourceButtonLabel(link, index)}
                </Button>
              ))}
            </div>
          ) : null}

          <form className="mt-5 min-w-0 max-w-full space-y-4 overflow-hidden" onSubmit={handleSubmit}>
            <label className="block min-w-0">
              <span className="text-sm font-medium text-bybs-body">Written response</span>
              <div className="mt-2 min-w-0 max-w-full">
                <RichTextEditor
                  id="written-response"
                  minHeightClassName="min-h-36"
                  onChange={setWrittenResponse}
                  placeholder="Write your reflection, link, notes, or assignment answer here."
                  value={writtenResponse}
                />
              </div>
            </label>

            <div>
              <input accept={RESOURCE_UPLOAD_ACCEPT} className="sr-only" onChange={handleUpload} ref={fileInputRef} type="file" />
              <Button
                className={assignmentButtonClassName}
                disabled={isUploading}
                icon={Upload}
                onClick={() => fileInputRef.current?.click()}
                type="button"
                variant="primary"
              >
                {isUploading ? "Uploading..." : uploadedFile ? "Replace file" : "Upload file"}
              </Button>
              <p className="mt-2 text-xs text-bybs-muted">
                Supported: PDF, Word, PowerPoint, Excel, CSV, text, image, or MP4. Maximum size: 50 MB.
              </p>
              {uploadedFile ? (
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-sm text-bybs-body">
                  <span className="min-w-0 truncate">{uploadedFile.originalName || "Submitted file"}</span>
                  {uploadedFileUrl ? (
                    <>
                      <Button
                        as="a"
                        className={assignmentButtonClassName}
                        href={uploadedFileUrl}
                        icon={ExternalLink}
                        rel="noreferrer"
                        size="sm"
                        target="_blank"
                        variant="primary"
                      >
                        View {uploadedFileLabel}
                      </Button>
                      <Button
                        as="a"
                        className={assignmentButtonClassName}
                        download
                        href={uploadedFileDownloadUrl}
                        icon={Download}
                        rel="noreferrer"
                        size="sm"
                        variant="primary"
                      >
                        Download {uploadedFileLabel}
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            <label className="block min-w-0">
              <span className="text-sm font-medium text-bybs-body">Submission link</span>
              <input
                className="mt-2 h-10 w-full rounded-md border border-bybs-border px-3 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale"
                onChange={(event) => setSubmissionLink(event.target.value)}
                placeholder="https://docs.google.com/... or another assignment link"
                type="url"
                value={submissionLink}
              />
              <span className="mt-1 block text-xs text-bybs-muted">Use this for Google Docs, Canva, YouTube, or other online submissions.</span>
            </label>

            {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
            {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

            <div className="flex min-w-0 flex-wrap gap-2">
              <Button disabled={isSubmitting} icon={Send} type="submit">
                {isSubmitting ? "Submitting..." : "Submit assignment"}
              </Button>
              <Button onClick={() => setActiveAssignment(null)} type="button" variant="secondary">
                Cancel
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {!assignments.length ? (
        <EmptyState
          description="Your cohort assignments will appear here when they are published."
          icon={ClipboardList}
          title="No assignments yet"
        />
      ) : (
        <div className="grid min-w-0 max-w-full gap-4 overflow-hidden xl:grid-cols-2">
          {assignments.map((assignment) => (
            <article className="min-w-0 max-w-full overflow-hidden rounded-lg border border-bybs-border bg-white p-4 shadow-sm" key={assignment._id}>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-bybs-blue">{titleFor(assignment.module, "General assignment")}</p>
                  <h2 className="mt-1 text-base font-semibold text-bybs-navy">{assignment.title}</h2>
                  <p className="mt-1 text-sm text-bybs-body">Due {formatDate(assignment.dueDate)}</p>
                  <p className="mt-1 text-sm text-bybs-muted">Posted by {postedBy(assignment)}</p>
                </div>
                <StatusBadge status={submissionStatus(assignment)} />
              </div>
              {assignment.submission?.feedback ? (
                <SafeHtml className="mt-3 rounded-md bg-bybs-pale p-3 text-sm text-bybs-body" html={assignment.submission.feedback} />
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button className={assignmentButtonClassName} onClick={() => chooseAssignment(assignment)} size="sm" type="button">
                  {assignment.submission ? "View submission and resources" : "View assignment and resources"}
                </Button>
                <AddToCalendarButton event={assignmentCalendarEvent(assignment)} fileName={`bybs-assignment-${assignment._id}`} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
