import { ClipboardList, ExternalLink, Send, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, EmptyState, PageHeader, SafeHtml, StatusBadge } from "@bybs/shared";
import { studentApi } from "../services/api.js";
import { formatDate, titleFor } from "../utils/format.js";

const textareaClassName = "min-h-28 w-full rounded-md border border-bybs-border px-3 py-2 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";

function submissionStatus(assignment) {
  return assignment.submission?.status || "notStarted";
}

export function AssignmentsPage() {
  const fileInputRef = useRef(null);
  const [assignments, setAssignments] = useState([]);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [writtenResponse, setWrittenResponse] = useState("");
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
        writtenResponse
      });
      setFeedback("Assignment submitted.");
      setActiveAssignment(null);
      setUploadedFile(null);
      setWrittenResponse("");
      await loadAssignments();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="View instructions, download templates, upload files, and read mentor feedback."
        title="Assignments"
      />

      {activeAssignment ? (
        <section className="rounded-lg border border-bybs-border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-bybs-blue">{titleFor(activeAssignment.module, "General assignment")}</p>
              <h2 className="mt-1 text-lg font-semibold text-bybs-navy">{activeAssignment.title}</h2>
              <p className="mt-1 text-sm text-bybs-body">Due {formatDate(activeAssignment.dueDate)}</p>
            </div>
            <StatusBadge status={submissionStatus(activeAssignment)} />
          </div>

          <SafeHtml
            className="mt-5 rounded-md bg-bybs-pale p-4 text-sm leading-6 text-bybs-body"
            html={activeAssignment.instructions}
          />

          {activeAssignment.templateFileUrl ? (
            <Button
              as="a"
              className="mt-4"
              href={activeAssignment.templateFileUrl}
              icon={ExternalLink}
              rel="noreferrer"
              size="sm"
              target="_blank"
              variant="secondary"
            >
              Open template
            </Button>
          ) : null}

          {activeAssignment.resourceLinks?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {activeAssignment.resourceLinks.map((link) => (
                <Button as="a" href={link.url} key={link.url} rel="noreferrer" size="sm" target="_blank" variant="secondary">
                  {link.title || "Resource"}
                </Button>
              ))}
            </div>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-bybs-body">Written response</span>
              <textarea
                className={textareaClassName}
                onChange={(event) => setWrittenResponse(event.target.value)}
                placeholder="Write your reflection, link, notes, or assignment answer here."
                value={writtenResponse}
              />
            </label>

            <div>
              <input className="sr-only" onChange={handleUpload} ref={fileInputRef} type="file" />
              <Button disabled={isUploading} icon={Upload} onClick={() => fileInputRef.current?.click()} type="button" variant="secondary">
                {isUploading ? "Uploading..." : uploadedFile ? "Replace file" : "Upload file"}
              </Button>
              {uploadedFile ? <p className="mt-2 text-sm text-bybs-body">{uploadedFile.originalName || uploadedFile.url}</p> : null}
            </div>

            {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
            {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

            <div className="flex flex-wrap gap-2">
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
        <div className="grid gap-4 xl:grid-cols-2">
          {assignments.map((assignment) => (
            <article className="rounded-lg border border-bybs-border bg-white p-4 shadow-sm" key={assignment._id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-bybs-blue">{titleFor(assignment.module, "General assignment")}</p>
                  <h2 className="mt-1 text-base font-semibold text-bybs-navy">{assignment.title}</h2>
                  <p className="mt-1 text-sm text-bybs-body">Due {formatDate(assignment.dueDate)}</p>
                </div>
                <StatusBadge status={submissionStatus(assignment)} />
              </div>
              {assignment.submission?.feedback ? (
                <SafeHtml className="mt-3 rounded-md bg-bybs-pale p-3 text-sm text-bybs-body" html={assignment.submission.feedback} />
              ) : null}
              <Button className="mt-4" onClick={() => chooseAssignment(assignment)} size="sm" type="button">
                {assignment.submission ? "View / resubmit" : "Open assignment"}
              </Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
