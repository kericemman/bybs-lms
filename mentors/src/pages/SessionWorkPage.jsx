import { FileText, Link, Plus, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card, DataTable, PageHeader, StatusBadge } from "@bybs/shared";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { mentorApi } from "../services/api.js";
import { formatDate, formatDateTime } from "../utils/format.js";

function tomorrowIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function initialForm() {
  return {
    session: "",
    module: "",
    materialTitle: "",
    recordingTitle: "",
    recordingUrl: "",
    assignmentTitle: "",
    assignmentOverview: "",
    assignmentTasks: "",
    assignmentDeliverables: "",
    gradingGuide: "",
    supportNotes: "",
    resourceLinks: [{ title: "", url: "" }],
    dueDate: tomorrowIsoDate(),
    maxScore: 100,
    allowResubmission: true,
    status: "published"
  };
}

export function SessionWorkPage() {
  const fileInputRef = useRef(null);
  const [sessions, setSessions] = useState([]);
  const [modules, setModules] = useState([]);
  const [form, setForm] = useState(() => initialForm());
  const [uploadedFile, setUploadedFile] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([mentorApi.listSessions(), mentorApi.listModules()])
      .then(([sessionResponse, moduleResponse]) => {
        const firstSession = sessionResponse.data[0];
        setSessions(sessionResponse.data);
        setModules(moduleResponse.data);
        setForm((current) => ({
          ...current,
          session: current.session || firstSession?._id || "",
          module: current.module || firstSession?.module?._id || firstSession?.module || ""
        }));
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateResourceLink(index, field, value) {
    setForm((current) => ({
      ...current,
      resourceLinks: current.resourceLinks.map((link, itemIndex) =>
        itemIndex === index ? { ...link, [field]: value } : link
      )
    }));
  }

  function addResourceLink() {
    setForm((current) => ({
      ...current,
      resourceLinks: [...current.resourceLinks, { title: "", url: "" }]
    }));
  }

  function removeResourceLink(index) {
    setForm((current) => ({
      ...current,
      resourceLinks: current.resourceLinks.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  function updateSession(sessionId) {
    const session = sessions.find((item) => item._id === sessionId);
    const sessionModuleId = session?.module?._id || session?.module || "";
    const cohortId = session?.cohort?._id || session?.cohort || "";
    const sessionModules = cohortId
      ? modules.filter((module) => String(module.cohort?._id || module.cohort || "") === String(cohortId))
      : modules;

    setForm((current) => ({
      ...current,
      session: sessionId,
      module: sessionModuleId || (sessionModules.some((module) => module._id === current.module) ? current.module : sessionModules[0]?._id || "")
    }));
  }

  function resetForm() {
    setForm((current) => ({
      ...initialForm(),
      session: current.session,
      module: current.module
    }));
    setUploadedFile(null);
    setError("");
    setFeedback("");
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setFeedback("");

    if (file.size > 50 * 1024 * 1024) {
      setError("Session material files must be 50 MB or smaller.");
      event.target.value = "";
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await mentorApi.uploadSessionFile(formData);
      setUploadedFile(response.data);
      setForm((current) => ({
        ...current,
        materialTitle: current.materialTitle || response.data.originalName || "Session materials"
      }));
      setFeedback(`${response.data.originalName || "File"} uploaded.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      const resourceLinks = form.resourceLinks
        .map((link) => ({
          title: link.title.trim(),
          url: link.url.trim()
        }))
        .filter((link) => link.url);
      const assignmentBreakdown = [
        form.assignmentOverview,
        form.assignmentTasks,
        form.assignmentDeliverables,
        form.gradingGuide,
        form.supportNotes
      ]
        .map((item) => item.trim())
        .filter(Boolean)
        .join("\n\n");
      const payload = {
        session: form.session,
        module: form.module,
        recordingTitle: form.recordingTitle.trim(),
        recordingUrl: form.recordingUrl.trim(),
        assignmentTitle: form.assignmentTitle.trim(),
        assignmentBreakdown,
        assignmentSections: {
          overview: form.assignmentOverview.trim(),
          tasks: form.assignmentTasks.trim(),
          deliverables: form.assignmentDeliverables.trim(),
          grading: form.gradingGuide.trim(),
          supportNotes: form.supportNotes.trim()
        },
        resourceLinks,
        dueDate: form.dueDate,
        maxScore: Number(form.maxScore),
        allowResubmission: form.allowResubmission,
        status: form.status
      };

      if (uploadedFile) {
        payload.materialFile = {
          title: form.materialTitle.trim() || uploadedFile.originalName,
          url: uploadedFile.url,
          fileType: uploadedFile.fileType
        };
      }

      const response = await mentorApi.createSessionWork(payload);
      setFeedback(`Session work published: ${response.data.assignment.title}. ${response.data.notifiedStudents || 0} student(s) notified.`);
      resetForm();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedSession = sessions.find((session) => session._id === form.session);
  const selectedSessionCohortId = selectedSession?.cohort?._id || selectedSession?.cohort || "";
  const availableModules = selectedSessionCohortId
    ? modules.filter((module) => String(module.cohort?._id || module.cohort || "") === String(selectedSessionCohortId))
    : modules;
  const selectedModule = modules.find((module) => module._id === form.module);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Publish post-session materials, recording links, and assignment breakdowns for students."
        title="Session work"
      />

      <Card>
        <form className="grid gap-4 lg:grid-cols-3" onSubmit={handleSubmit}>
          <FormField label="Session">
            <select className={inputClassName} onChange={(event) => updateSession(event.target.value)} required value={form.session}>
              <option value="">Choose session</option>
              {sessions.map((session) => (
                <option key={session._id} value={session._id}>
                  {session.title} - {session.module?.title || "No module"} - {formatDateTime(session.startsAt)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Module">
            <select
              className={inputClassName}
              disabled={!availableModules.length}
              onChange={(event) => updateField("module", event.target.value)}
              required={Boolean(availableModules.length)}
              value={form.module}
            >
              <option value="">{availableModules.length ? "Choose module" : "No module available"}</option>
              {availableModules.map((module) => (
                <option key={module._id} value={module._id}>
                  {module.title}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Assignment title">
            <input
              className={inputClassName}
              onChange={(event) => updateField("assignmentTitle", event.target.value)}
              placeholder="Session reflection and action plan"
              required
              value={form.assignmentTitle}
            />
          </FormField>
          <FormField label="Due date">
            <input className={inputClassName} onChange={(event) => updateField("dueDate", event.target.value)} required type="date" value={form.dueDate} />
          </FormField>

          {selectedSession ? (
            <div className="rounded-md border border-bybs-border bg-bybs-pale p-4 text-sm lg:col-span-3">
              <p className="font-semibold text-bybs-navy">{selectedModule?.title || selectedSession.module?.title || "Module not selected"}</p>
              <p className="mt-1 text-bybs-body">
                {selectedSession.cohort?.title || "Cohort"} · {selectedModule?.startDate || selectedModule?.endDate ? `${formatDate(selectedModule?.startDate)} - ${formatDate(selectedModule?.endDate)}` : "Module dates not set"}
              </p>
            </div>
          ) : null}

          <div className="rounded-md border border-bybs-border bg-bybs-pale p-4 lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-bybs-navy">Slides, PDF, or document</p>
                <p className="mt-1 text-sm text-bybs-body">{uploadedFile ? uploadedFile.originalName : "Upload the session material students should read or download."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {uploadedFile ? (
                  <Button icon={X} onClick={() => setUploadedFile(null)} type="button" variant="secondary">
                    Remove file
                  </Button>
                ) : null}
                <Button disabled={isUploading} icon={Upload} onClick={() => fileInputRef.current?.click()} type="button" variant="secondary">
                  {isUploading ? "Uploading..." : "Upload file"}
                </Button>
                <input
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
                  className="sr-only"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  type="file"
                />
              </div>
            </div>
            {uploadedFile ? (
              <div className="mt-4">
                <FormField label="Material title">
                  <input className={inputClassName} onChange={(event) => updateField("materialTitle", event.target.value)} value={form.materialTitle} />
                </FormField>
              </div>
            ) : null}
          </div>

          <FormField label="Recording title">
            <input className={inputClassName} onChange={(event) => updateField("recordingTitle", event.target.value)} placeholder="Session recording" value={form.recordingTitle} />
          </FormField>
          <div className="lg:col-span-2">
            <FormField label="YouTube recording link">
              <input className={inputClassName} onChange={(event) => updateField("recordingUrl", event.target.value)} placeholder="https://youtube.com/..." type="url" value={form.recordingUrl} />
            </FormField>
          </div>

          <div className="lg:col-span-3">
            <FormField label="Assignment overview">
              <textarea
                className={`${textAreaClassName} min-h-40`}
                onChange={(event) => updateField("assignmentOverview", event.target.value)}
                placeholder="Set context for the assignment, why it matters, and what students should focus on."
                required
                value={form.assignmentOverview}
              />
            </FormField>
          </div>

          <div className="lg:col-span-3">
            <FormField label="Tasks and steps">
              <textarea
                className={`${textAreaClassName} min-h-40`}
                onChange={(event) => updateField("assignmentTasks", event.target.value)}
                placeholder="List the exact steps students should follow. Use clear numbered steps where helpful."
                required
                value={form.assignmentTasks}
              />
            </FormField>
          </div>

          <div className="lg:col-span-3">
            <FormField label="Expected submission">
              <textarea
                className={textAreaClassName}
                onChange={(event) => updateField("assignmentDeliverables", event.target.value)}
                placeholder="Describe what students should submit: file type, format, length, screenshots, links, or reflection notes."
                value={form.assignmentDeliverables}
              />
            </FormField>
          </div>

          <div className="lg:col-span-2">
            <FormField label="Grading guide">
              <textarea
                className={textAreaClassName}
                onChange={(event) => updateField("gradingGuide", event.target.value)}
                placeholder="Explain how the work will be assessed: completeness, quality, reflection, presentation, or rubric points."
                value={form.gradingGuide}
              />
            </FormField>
          </div>

          <FormField label="Support notes">
            <textarea
              className={textAreaClassName}
              onChange={(event) => updateField("supportNotes", event.target.value)}
              placeholder="Add reminders, office hours, common mistakes, or how to ask for help."
              value={form.supportNotes}
            />
          </FormField>

          <div className="space-y-3 rounded-md border border-bybs-border bg-white p-4 lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-bybs-navy">Assignment resource links</p>
                <p className="mt-1 text-sm text-bybs-body">Add helpful links students should use alongside the uploaded material.</p>
              </div>
              <Button icon={Link} onClick={addResourceLink} type="button" variant="secondary">
                Add link
              </Button>
            </div>
            {form.resourceLinks.map((resourceLink, index) => (
              <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]" key={`resource-link-${index}`}>
                <input
                  className={inputClassName}
                  onChange={(event) => updateResourceLink(index, "title", event.target.value)}
                  placeholder="Resource title"
                  value={resourceLink.title}
                />
                <input
                  className={inputClassName}
                  onChange={(event) => updateResourceLink(index, "url", event.target.value)}
                  placeholder="https://..."
                  type="url"
                  value={resourceLink.url}
                />
                <Button
                  disabled={form.resourceLinks.length === 1}
                  icon={X}
                  onClick={() => removeResourceLink(index)}
                  type="button"
                  variant="secondary"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-bybs-border bg-bybs-pale p-4 text-sm leading-6 text-bybs-body lg:col-span-3">
            <p className="font-semibold text-bybs-navy">Student layout preview</p>
            <p className="mt-2">The assignment will be saved with clear sections: overview, tasks, expected submission, grading guide, resource links, and support notes.</p>
          </div>

          <FormField label="Max score">
            <input className={inputClassName} max="1000" min="1" onChange={(event) => updateField("maxScore", event.target.value)} type="number" value={form.maxScore} />
          </FormField>
          <FormField label="Status">
            <select className={inputClassName} onChange={(event) => updateField("status", event.target.value)} value={form.status}>
              <option value="published">Publish now</option>
              <option value="draft">Save as draft</option>
            </select>
          </FormField>
          <label className="flex items-center gap-3 self-end text-sm font-medium text-bybs-navy">
            <input
              checked={form.allowResubmission}
              className="h-4 w-4 rounded border-bybs-border"
              onChange={(event) => updateField("allowResubmission", event.target.checked)}
              type="checkbox"
            />
            Allow resubmission
          </label>

          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-3">{error}</p> : null}
          {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue lg:col-span-3">{feedback}</p> : null}

          <div className="flex flex-wrap gap-2 lg:col-span-3">
            <Button disabled={isSubmitting || isUploading} icon={Plus} type="submit">
              {isSubmitting ? "Publishing..." : "Publish session work"}
            </Button>
            <Button icon={X} onClick={resetForm} type="button" variant="secondary">
              Reset
            </Button>
          </div>
        </form>
      </Card>

      <DataTable
        columns={[
          { key: "title", header: "Session" },
          { key: "startsAt", header: "Date", render: (row) => formatDateTime(row.startsAt) },
          { key: "cohort", header: "Cohort", render: (row) => row.cohort?.title || "Cohort" },
          { key: "module", header: "Module", render: (row) => row.module?.title || "Unassigned" },
          { key: "moduleDates", header: "Module dates", render: (row) => row.module?.startDate || row.module?.endDate ? `${formatDate(row.module?.startDate)} - ${formatDate(row.module?.endDate)}` : "Not set" },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> }
        ]}
        emptyDescription="Sessions created by Admin for your cohort will appear here."
        emptyTitle="No sessions available"
        rows={sessions}
      />
    </div>
  );
}
