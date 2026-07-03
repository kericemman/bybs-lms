import { CalendarCheck, Mail, MessageSquareText, Search, Send, Star, Trash2, UserCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  Card,
  DataTable,
  PageHeader,
  SafeHtml,
  StatusBadge,
  formatInternationalPhone
} from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { adminApi } from "../services/api.js";
import { formatDateTime } from "../utils/format.js";
import { canDeleteOperationalRecords } from "../utils/permissions.js";

const statusOptions = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "accepted", label: "Accepted" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "rejected", label: "Rejected" }
];

const applicantTypeOptions = [
  { value: "student", label: "Students" },
  { value: "mentor", label: "Mentors" }
];

const feedbackStatusOptions = [
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "resolved", label: "Resolved" }
];

const feedbackRoleOptions = [
  { value: "student", label: "Students" },
  { value: "mentor", label: "Mentors" }
];

const feedbackCategoryLabels = {
  overall: "Overall experience",
  bug: "Bug or error",
  navigation: "Navigation",
  content: "Content or resources",
  assignments: "Assignments",
  sessions: "Sessions",
  notifications: "Notifications",
  performance: "Speed or performance",
  support: "Support",
  featureRequest: "Feature request",
  other: "Other"
};

const statusTone = {
  new: "info",
  reviewing: "warning",
  accepted: "success",
  waitlisted: "neutral",
  rejected: "danger"
};

const feedbackStatusTone = {
  new: "info",
  reviewed: "warning",
  resolved: "success"
};

const testerAccountTone = {
  created: "success",
  existing: "info",
  failed: "danger",
  notRequested: "neutral"
};

const emptyFilters = { search: "", status: "", applicantType: "" };
const emptyFeedbackFilters = { search: "", status: "", role: "" };

function applicationId(application) {
  return application?.id || application?._id;
}

function feedbackId(feedback) {
  return feedback?.id || feedback?._id;
}

function applicantTypeLabel(value) {
  if (value === "mentor") return "Mentor tester";
  return "Student tester";
}

function feedbackRoleLabel(value) {
  if (value === "mentor") return "Mentor";
  return "Student";
}

function feedbackCategoryLabel(value) {
  return feedbackCategoryLabels[value] || value || "Overall experience";
}

function acceptanceEmailLabel(application) {
  if (application.acceptanceEmailStatus === "sent") return "Email sent";
  if (application.acceptanceEmailStatus === "failed") return "Email failed";
  if (application.acceptanceEmailStatus === "notConfigured") return "Email not configured";
  return "Not sent";
}

function testerAccountLabel(application) {
  if (application.testerAccountStatus === "created") return "Account created";
  if (application.testerAccountStatus === "existing") return "Existing account";
  if (application.testerAccountStatus === "failed") return "Account failed";
  return "Not created";
}

function acceptanceFeedbackMessage(application) {
  const emailStatus = acceptanceEmailLabel(application).toLowerCase();
  const accountStatus = testerAccountLabel(application).toLowerCase();
  return `${application.name} accepted as ${applicantTypeLabel(application.applicantType).toLowerCase()}. Account: ${accountStatus}. Acceptance email: ${emailStatus}.`;
}

function emailWasSent(application) {
  return application.acceptanceEmailStatus === "sent";
}

function DetailRow({ label, value, children }) {
  return (
    <div className="rounded-md bg-bybs-pale p-3">
      <p className="text-xs font-semibold uppercase text-bybs-muted">{label}</p>
      {children || <p className="mt-1 text-sm font-medium text-bybs-navy">{value || "Not set"}</p>}
    </div>
  );
}

export function BetaApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [acceptedStudents, setAcceptedStudents] = useState([]);
  const [acceptedMentors, setAcceptedMentors] = useState([]);
  const [betaFeedback, setBetaFeedback] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedFeedbackId, setSelectedFeedbackId] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [feedbackFilters, setFeedbackFilters] = useState(emptyFeedbackFilters);
  const [reviewForm, setReviewForm] = useState({ status: "reviewing", adminNotes: "" });
  const [feedbackReviewForm, setFeedbackReviewForm] = useState({ status: "new", adminNotes: "" });
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [acceptingId, setAcceptingId] = useState("");
  const [emailingId, setEmailingId] = useState("");
  const [isFeedbackSaving, setIsFeedbackSaving] = useState(false);
  const canDelete = canDeleteOperationalRecords(user);

  const selectedApplication = useMemo(
    () =>
      [...applications, ...acceptedStudents, ...acceptedMentors].find((application) => applicationId(application) === selectedId) ||
      applications[0] ||
      acceptedStudents[0] ||
      acceptedMentors[0] ||
      null,
    [applications, acceptedStudents, acceptedMentors, selectedId]
  );

  const selectedFeedback = useMemo(
    () => betaFeedback.find((item) => feedbackId(item) === selectedFeedbackId) || betaFeedback[0] || null,
    [betaFeedback, selectedFeedbackId]
  );

  async function loadApplications() {
    const response = await adminApi.listBetaApplications(filters);
    setApplications(response.data);

    if (response.data.length && !response.data.some((application) => applicationId(application) === selectedId)) {
      setSelectedId(applicationId(response.data[0]));
    }
  }

  async function loadAcceptedApplications() {
    const [studentResponse, mentorResponse] = await Promise.all([
      adminApi.listBetaApplications({ status: "accepted", applicantType: "student" }),
      adminApi.listBetaApplications({ status: "accepted", applicantType: "mentor" })
    ]);

    setAcceptedStudents(studentResponse.data);
    setAcceptedMentors(mentorResponse.data);
  }

  async function loadBetaFeedback() {
    const response = await adminApi.listBetaFeedback(feedbackFilters);
    setBetaFeedback(response.data);

    if (response.data.length && !response.data.some((item) => feedbackId(item) === selectedFeedbackId)) {
      setSelectedFeedbackId(feedbackId(response.data[0]));
    }
  }

  useEffect(() => {
    loadApplications().catch((requestError) => setError(requestError.message));
  }, [filters]);

  useEffect(() => {
    loadAcceptedApplications().catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    loadBetaFeedback().catch((requestError) => setError(requestError.message));
  }, [feedbackFilters]);

  useEffect(() => {
    if (!selectedApplication) return;

    setReviewForm({
      status: selectedApplication.status || "reviewing",
      adminNotes: selectedApplication.adminNotes || ""
    });
  }, [selectedApplication]);

  useEffect(() => {
    if (!selectedFeedback) return;

    setFeedbackReviewForm({
      status: selectedFeedback.status || "new",
      adminNotes: selectedFeedback.adminNotes || ""
    });
  }, [selectedFeedback]);

  async function updateApplication(event) {
    event.preventDefault();

    if (!selectedApplication) return;

    setError("");
    setFeedback("");
    setIsSaving(true);

    try {
      const response = await adminApi.updateBetaApplication(applicationId(selectedApplication), reviewForm);
      setApplications((current) =>
        current.map((application) =>
          applicationId(application) === applicationId(response.data) ? response.data : application
        )
      );
      if (response.data.status === "accepted") {
        setFeedback(acceptanceFeedbackMessage(response.data));
        if (emailWasSent(response.data)) {
          toast.success("Beta application accepted and email sent.");
        } else {
          toast.error(acceptanceFeedbackMessage(response.data));
        }
      } else {
        setFeedback("Beta application updated.");
        toast.success("Beta application updated.");
      }
      await loadAcceptedApplications();
    } catch (requestError) {
      setError(requestError.message);
      toast.error(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteApplication(application) {
    const confirmed = window.confirm(`Delete ${application.name}'s beta application?`);
    if (!confirmed) return;

    setError("");
    setFeedback("");

    try {
      await adminApi.deleteBetaApplication(applicationId(application));
      setApplications((current) => current.filter((item) => applicationId(item) !== applicationId(application)));
      setSelectedId("");
      setFeedback("Beta application deleted.");
      await loadAcceptedApplications();
      toast.success("Beta application deleted.");
    } catch (requestError) {
      setError(requestError.message);
      toast.error(requestError.message);
    }
  }

  async function acceptApplication(application) {
    const id = applicationId(application);

    if (!id) return;

    setError("");
    setFeedback("");
    setAcceptingId(id);

    try {
      const response = await adminApi.updateBetaApplication(id, { status: "accepted" });
      setApplications((current) =>
        current.map((item) => applicationId(item) === applicationId(response.data) ? response.data : item)
      );
      setSelectedId(applicationId(response.data));
      setFeedback(acceptanceFeedbackMessage(response.data));
      await Promise.all([loadApplications(), loadAcceptedApplications()]);
      if (emailWasSent(response.data)) {
        toast.success("Application accepted and email sent.");
      } else {
        toast.error(acceptanceFeedbackMessage(response.data));
      }
    } catch (requestError) {
      setError(requestError.message);
      const failedApplication = requestError.details?.application;

      if (failedApplication) {
        setApplications((current) =>
          current.map((item) => applicationId(item) === applicationId(failedApplication) ? failedApplication : item)
        );
        setSelectedId(applicationId(failedApplication));
      }

      await Promise.all([loadApplications(), loadAcceptedApplications()]).catch(() => {});
      toast.error(requestError.message);
    } finally {
      setAcceptingId("");
    }
  }

  async function sendAcceptanceEmail(application) {
    const id = applicationId(application);

    if (!id) return;

    setError("");
    setFeedback("");
    setEmailingId(id);

    try {
      const response = await adminApi.sendBetaAcceptanceEmail(id);
      setApplications((current) =>
        current.map((item) => applicationId(item) === applicationId(response.data) ? response.data : item)
      );
      setSelectedId(applicationId(response.data));
      setFeedback(`Acceptance email ${acceptanceEmailLabel(response.data).toLowerCase()} for ${response.data.name}.`);
      await Promise.all([loadApplications(), loadAcceptedApplications()]);
      toast.success("Acceptance email sent.");
    } catch (requestError) {
      setError(requestError.message);
      const failedApplication = requestError.details?.application;

      if (failedApplication) {
        setApplications((current) =>
          current.map((item) => applicationId(item) === applicationId(failedApplication) ? failedApplication : item)
        );
        setSelectedId(applicationId(failedApplication));
      }

      await Promise.all([loadApplications(), loadAcceptedApplications()]).catch(() => {});
      toast.error(requestError.message);
    } finally {
      setEmailingId("");
    }
  }

  async function updateFeedbackReview(event) {
    event.preventDefault();

    if (!selectedFeedback) return;

    setError("");
    setFeedback("");
    setIsFeedbackSaving(true);

    try {
      const response = await adminApi.updateBetaFeedback(feedbackId(selectedFeedback), feedbackReviewForm);
      setBetaFeedback((current) =>
        current.map((item) => feedbackId(item) === feedbackId(response.data) ? response.data : item)
      );
      setFeedback("Beta feedback updated.");
      toast.success("Beta feedback updated.");
    } catch (requestError) {
      setError(requestError.message);
      toast.error(requestError.message);
    } finally {
      setIsFeedbackSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review student and mentor beta tester applications submitted from the public access page."
        title="Beta Applications"
      />

      <div className="rounded-lg border border-bybs-border bg-bybs-pale p-4 shadow-sm">
        <div className="flex gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-bybs-blue ring-1 ring-bybs-border">
            <CalendarCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase text-bybs-blue">Beta testing window</p>
            <h2 className="mt-1 text-lg font-semibold text-bybs-navy">July 3 to July 17, 2026</h2>
            <p className="mt-1 text-sm leading-6 text-bybs-body">
              Use this page to review applications, confirm selected testers, and track follow-up during the two-week beta period.
            </p>
          </div>
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold uppercase text-bybs-blue">Accepted student testers</p>
            <p className="mt-1 text-sm text-bybs-body">Students approved for BYBS LMS beta testing.</p>
          </div>
          <DataTable
            columns={[
              {
                key: "name",
                header: "Student",
                wrap: true,
                render: (row) => (
                  <button className="text-left" onClick={() => setSelectedId(applicationId(row))} type="button">
                    <span className="font-medium text-bybs-navy">{row.name}</span>
                    <span className="mt-1 block text-xs text-bybs-muted">{row.email}</span>
                  </button>
                )
              },
              { key: "acceptedAt", header: "Accepted", render: (row) => formatDateTime(row.reviewedAt || row.updatedAt) },
              {
                key: "account",
                header: "Account",
                render: (row) => (
                  <StatusBadge
                    label={testerAccountLabel(row)}
                    status={row.testerAccountStatus || "notRequested"}
                    tone={testerAccountTone[row.testerAccountStatus]}
                  />
                )
              },
              { key: "email", header: "Email notice", render: (row) => acceptanceEmailLabel(row) },
              {
                key: "actions",
                header: "Actions",
                render: (row) => (
                  <Button
                    disabled={emailingId === applicationId(row)}
                    icon={Send}
                    onClick={() => sendAcceptanceEmail(row)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {emailingId === applicationId(row) ? "Sending..." : row.acceptanceEmailStatus === "sent" ? "Resend" : "Send email"}
                  </Button>
                )
              }
            ]}
            emptyDescription="Accepted student beta testers will appear here after approval."
            emptyTitle="No accepted students"
            rows={acceptedStudents}
          />
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold uppercase text-bybs-rose">Accepted mentor testers</p>
            <p className="mt-1 text-sm text-bybs-body">Mentors approved for BYBS LMS beta testing.</p>
          </div>
          <DataTable
            columns={[
              {
                key: "name",
                header: "Mentor",
                wrap: true,
                render: (row) => (
                  <button className="text-left" onClick={() => setSelectedId(applicationId(row))} type="button">
                    <span className="font-medium text-bybs-navy">{row.name}</span>
                    <span className="mt-1 block text-xs text-bybs-muted">{row.email}</span>
                  </button>
                )
              },
              { key: "acceptedAt", header: "Accepted", render: (row) => formatDateTime(row.reviewedAt || row.updatedAt) },
              {
                key: "account",
                header: "Account",
                render: (row) => (
                  <StatusBadge
                    label={testerAccountLabel(row)}
                    status={row.testerAccountStatus || "notRequested"}
                    tone={testerAccountTone[row.testerAccountStatus]}
                  />
                )
              },
              { key: "email", header: "Email notice", render: (row) => acceptanceEmailLabel(row) },
              {
                key: "actions",
                header: "Actions",
                render: (row) => (
                  <Button
                    disabled={emailingId === applicationId(row)}
                    icon={Send}
                    onClick={() => sendAcceptanceEmail(row)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {emailingId === applicationId(row) ? "Sending..." : row.acceptanceEmailStatus === "sent" ? "Resend" : "Send email"}
                  </Button>
                )
              }
            ]}
            emptyDescription="Accepted mentor beta testers will appear here after approval."
            emptyTitle="No accepted mentors"
            rows={acceptedMentors}
          />
        </div>
      </section>

      <div className="grid gap-3 rounded-lg border border-bybs-border bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_220px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-bybs-muted" aria-hidden="true" />
          <input
            className={`${inputClassName} pl-9`}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Search name, email, phone, or motivation"
            value={filters.search}
          />
        </div>
        <select
          className={inputClassName}
          onChange={(event) => setFilters((current) => ({ ...current, applicantType: event.target.value }))}
          value={filters.applicantType}
        >
          <option value="">All applicants</option>
          {applicantTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          className={inputClassName}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          value={filters.status}
        >
          <option value="">All statuses</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <Button icon={X} onClick={() => setFilters(emptyFilters)} type="button" variant="secondary">
          Reset
        </Button>
      </div>

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <DataTable
          columns={[
            {
              key: "name",
              header: "Applicant",
              wrap: true,
              render: (row) => (
                <button
                  className="text-left"
                  onClick={() => setSelectedId(applicationId(row))}
                  type="button"
                >
                  <span className="font-medium text-bybs-navy">{row.name}</span>
                  <span className="mt-1 block text-xs text-bybs-muted">{row.email}</span>
                </button>
              )
            },
            { key: "applicantType", header: "Type", render: (row) => applicantTypeLabel(row.applicantType) },
            { key: "source", header: "Heard from", render: (row) => row.source || "Not set" },
            { key: "phone", header: "Phone", render: (row) => formatInternationalPhone(row.phone) },
            { key: "createdAt", header: "Submitted", render: (row) => formatDateTime(row.createdAt) },
            {
              key: "status",
              header: "Status",
              render: (row) => <StatusBadge status={row.status} tone={statusTone[row.status]} />
            },
            {
              key: "actions",
              header: "Actions",
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  {row.status !== "accepted" ? (
                    <Button
                      disabled={acceptingId === applicationId(row)}
                      icon={UserCheck}
                      onClick={() => acceptApplication(row)}
                      size="sm"
                      type="button"
                    >
                      {acceptingId === applicationId(row) ? "Accepting..." : "Accept"}
                    </Button>
                  ) : null}
                  <Button icon={UserCheck} onClick={() => setSelectedId(applicationId(row))} size="sm" type="button" variant="secondary">
                    Review
                  </Button>
                  {canDelete ? (
                    <Button icon={Trash2} onClick={() => deleteApplication(row)} size="sm" type="button" variant="danger">
                      Delete
                    </Button>
                  ) : null}
                </div>
              )
            }
          ]}
          emptyDescription="Applications submitted from the public page will appear here."
          emptyTitle="No beta applications"
          rows={applications}
        />

        <Card>
          {!selectedApplication ? (
            <p className="text-sm text-bybs-body">Select an application to review.</p>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase text-bybs-blue">{applicantTypeLabel(selectedApplication.applicantType)}</p>
                <h2 className="mt-1 text-xl font-semibold text-bybs-navy">{selectedApplication.name}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={selectedApplication.status} tone={statusTone[selectedApplication.status]} />
                  <a className="inline-flex items-center gap-2 text-sm font-medium text-bybs-blue" href={`mailto:${selectedApplication.email}`}>
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Email
                  </a>
                </div>
              </div>

              <div className="grid gap-3">
                <DetailRow label="Email" value={selectedApplication.email} />
                <DetailRow label="Phone" value={formatInternationalPhone(selectedApplication.phone)} />
                <DetailRow label="Location" value={selectedApplication.location} />
                <DetailRow label="Experience" value={selectedApplication.experienceLevel} />
                <DetailRow label="Availability" value={selectedApplication.availability} />
                <DetailRow label="Source" value={selectedApplication.source} />
                <DetailRow label="Submitted" value={formatDateTime(selectedApplication.createdAt)} />
                <DetailRow label="Tester account" value={testerAccountLabel(selectedApplication)} />
                {selectedApplication.testerUser ? (
                  <DetailRow
                    label="Linked account"
                    value={`${selectedApplication.testerUser.email || selectedApplication.email} (${selectedApplication.testerUser.status || "active"})`}
                  />
                ) : null}
                {selectedApplication.testerAccountError ? (
                  <DetailRow label="Account error" value={selectedApplication.testerAccountError} />
                ) : null}
                <DetailRow label="Acceptance email" value={acceptanceEmailLabel(selectedApplication)} />
                {selectedApplication.acceptanceEmailSentAt ? (
                  <DetailRow label="Email sent at" value={formatDateTime(selectedApplication.acceptanceEmailSentAt)} />
                ) : null}
                {selectedApplication.acceptanceEmailError ? (
                  <DetailRow label="Email error" value={selectedApplication.acceptanceEmailError} />
                ) : null}
              </div>

              <div>
                <p className="text-sm font-medium text-bybs-body">Motivation</p>
                <SafeHtml className="mt-2 rounded-md bg-bybs-pale p-3 text-sm leading-6 text-bybs-body" html={selectedApplication.motivation} />
              </div>

              <form className="space-y-4" onSubmit={updateApplication}>
                {selectedApplication.status !== "accepted" ? (
                  <Button
                    className="w-full"
                    disabled={acceptingId === applicationId(selectedApplication)}
                    icon={UserCheck}
                    onClick={() => acceptApplication(selectedApplication)}
                    type="button"
                  >
                    {acceptingId === applicationId(selectedApplication) ? "Accepting..." : "Accept application and email applicant"}
                  </Button>
                ) : null}
                {selectedApplication.status === "accepted" ? (
                  <Button
                    className="w-full"
                    disabled={emailingId === applicationId(selectedApplication)}
                    icon={Send}
                    onClick={() => sendAcceptanceEmail(selectedApplication)}
                    type="button"
                    variant="secondary"
                  >
                    {emailingId === applicationId(selectedApplication)
                      ? "Sending acceptance email..."
                      : selectedApplication.acceptanceEmailStatus === "sent"
                        ? "Resend acceptance email"
                        : "Send acceptance email"}
                  </Button>
                ) : null}
                <FormField label="Review status">
                  <select
                    className={inputClassName}
                    onChange={(event) => setReviewForm((current) => ({ ...current, status: event.target.value }))}
                    value={reviewForm.status}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Admin notes">
                  <textarea
                    className={textAreaClassName}
                    onChange={(event) => setReviewForm((current) => ({ ...current, adminNotes: event.target.value }))}
                    placeholder="Internal note about selection, follow-up, or concern."
                    value={reviewForm.adminNotes}
                  />
                </FormField>
                <Button disabled={isSaving} type="submit">
                  {isSaving ? "Saving..." : "Save review"}
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>

      <section className="space-y-4">
        <div className="rounded-lg border border-bybs-border bg-white p-4 shadow-sm">
          <div className="flex gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-bybs-pale text-bybs-blue">
              <MessageSquareText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase text-bybs-blue">Beta feedback inbox</p>
              <h2 className="mt-1 text-lg font-semibold text-bybs-navy">Feedback from students and mentors</h2>
              <p className="mt-1 text-sm leading-6 text-bybs-body">
                Review what testers are experiencing inside the student and mentor portals, then mark items reviewed or resolved.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border border-bybs-border bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-bybs-muted" aria-hidden="true" />
            <input
              className={`${inputClassName} pl-9`}
              onChange={(event) => setFeedbackFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search feedback, name, or email"
              value={feedbackFilters.search}
            />
          </div>
          <select
            className={inputClassName}
            onChange={(event) => setFeedbackFilters((current) => ({ ...current, role: event.target.value }))}
            value={feedbackFilters.role}
          >
            <option value="">All roles</option>
            {feedbackRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            className={inputClassName}
            onChange={(event) => setFeedbackFilters((current) => ({ ...current, status: event.target.value }))}
            value={feedbackFilters.status}
          >
            <option value="">All statuses</option>
            {feedbackStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Button icon={X} onClick={() => setFeedbackFilters(emptyFeedbackFilters)} type="button" variant="secondary">
            Reset
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <DataTable
            columns={[
              {
                key: "userName",
                header: "Tester",
                wrap: true,
                render: (row) => (
                  <button className="text-left" onClick={() => setSelectedFeedbackId(feedbackId(row))} type="button">
                    <span className="font-medium text-bybs-navy">{row.userName}</span>
                    <span className="mt-1 block text-xs text-bybs-muted">{row.userEmail}</span>
                  </button>
                )
              },
              { key: "role", header: "Role", render: (row) => feedbackRoleLabel(row.role) },
              {
                key: "subject",
                header: "Feedback",
                wrap: true,
                render: (row) => (
                  <div>
                    <p className="font-medium text-bybs-navy">{row.subject}</p>
                    <p className="mt-1 text-xs text-bybs-muted">{feedbackCategoryLabel(row.category)}</p>
                  </div>
                )
              },
              {
                key: "rating",
                header: "Rating",
                render: (row) => (
                  <span className="inline-flex items-center gap-1 font-medium text-bybs-navy">
                    <Star className="h-4 w-4 fill-bybs-gold text-bybs-gold" aria-hidden="true" />
                    {row.rating}/5
                  </span>
                )
              },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} tone={feedbackStatusTone[row.status]} /> },
              { key: "createdAt", header: "Sent", render: (row) => formatDateTime(row.createdAt) }
            ]}
            emptyDescription="Feedback sent from student and mentor portals will appear here."
            emptyTitle="No beta feedback yet"
            rows={betaFeedback}
          />

          <Card>
            {!selectedFeedback ? (
              <p className="text-sm text-bybs-body">Select feedback to review.</p>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-semibold uppercase text-bybs-blue">{feedbackRoleLabel(selectedFeedback.role)} feedback</p>
                  <h2 className="mt-1 text-xl font-semibold text-bybs-navy">{selectedFeedback.subject}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge status={selectedFeedback.status} tone={feedbackStatusTone[selectedFeedback.status]} />
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-bybs-navy">
                      <Star className="h-4 w-4 fill-bybs-gold text-bybs-gold" aria-hidden="true" />
                      {selectedFeedback.rating}/5
                    </span>
                  </div>
                </div>

                <div className="grid gap-3">
                  <DetailRow label="Tester" value={selectedFeedback.userName} />
                  <DetailRow label="Email" value={selectedFeedback.userEmail} />
                  <DetailRow label="Category" value={feedbackCategoryLabel(selectedFeedback.category)} />
                  <DetailRow label="Submitted" value={formatDateTime(selectedFeedback.createdAt)} />
                </div>

                <div>
                  <p className="text-sm font-medium text-bybs-body">Message</p>
                  <p className="mt-2 rounded-md bg-bybs-pale p-3 text-sm leading-6 text-bybs-body">{selectedFeedback.message}</p>
                </div>

                <form className="space-y-4" onSubmit={updateFeedbackReview}>
                  <FormField label="Feedback status">
                    <select
                      className={inputClassName}
                      onChange={(event) => setFeedbackReviewForm((current) => ({ ...current, status: event.target.value }))}
                      value={feedbackReviewForm.status}
                    >
                      {feedbackStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Admin notes">
                    <textarea
                      className={textAreaClassName}
                      onChange={(event) => setFeedbackReviewForm((current) => ({ ...current, adminNotes: event.target.value }))}
                      placeholder="Internal note about what changed, who followed up, or why this is resolved."
                      value={feedbackReviewForm.adminNotes}
                    />
                  </FormField>
                  <Button disabled={isFeedbackSaving} type="submit">
                    {isFeedbackSaving ? "Saving..." : "Save feedback review"}
                  </Button>
                </form>
              </div>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
