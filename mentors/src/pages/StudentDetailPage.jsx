import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Award, Mail, Send, ShieldCheck, UserRound } from "lucide-react";
import {
  Button,
  Card,
  DataTable,
  PageHeader,
  ProgressBar,
  SafeHtml,
  StatCard,
  StatusBadge,
  formatInternationalPhone
} from "@bybs/shared";
import { mentorApi } from "../services/api.js";
import { formatDate, formatDateTime } from "../utils/format.js";

const emptyMessage = {
  title: "",
  message: ""
};

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function emailStatusMessage(status) {
  if (status === "sent") {
    return "Message saved in the mentee portal and email notification delivered.";
  }

  if (status === "notConfigured") {
    return "Message saved in the mentee portal. Email is not configured on this environment.";
  }

  if (status === "failed") {
    return "Message saved in the mentee portal, but the email notification could not be delivered.";
  }

  return "Message saved in the mentee portal.";
}

function SystemProgressPanel({ progress }) {
  if (!progress) {
    return (
      <div className="mt-5 rounded-md border border-bybs-border p-4">
        <p className="text-sm font-semibold text-bybs-navy">System graduation check</p>
        <p className="mt-2 text-sm text-bybs-body">Graduation progress is not available yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-md border border-bybs-border p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-bybs-navy">System graduation check</p>
          <p className="mt-1 text-sm text-bybs-body">
            Recommendations open when the computed progress confirms this mentee is graduation-ready.
          </p>
        </div>
        <StatusBadge
          label={progress.graduationReady ? "Graduation ready" : "Not ready yet"}
          status={progress.graduationReady ? "approved" : "pending"}
        />
      </div>

      {progress.error ? (
        <p className="mt-3 rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{progress.error}</p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {[
          ["Overall progress", progress.progress],
          ["Assignment completion", progress.assignmentCompletionPercentage],
          ["Approved score", progress.scorePercentage],
          ["Attendance", progress.attendancePercentage],
          ["Punctuality", progress.punctualityPercentage]
        ].map(([label, value]) => (
          <div className="rounded-md bg-bybs-pale p-3" key={label}>
            <ProgressBar label={label} value={value || 0} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudentDetailPage() {
  const { id } = useParams();
  const [details, setDetails] = useState(null);
  const [message, setMessage] = useState(emptyMessage);
  const [graduationNotes, setGraduationNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadStudent() {
    const response = await mentorApi.getStudent(id);
    setDetails(response.data);
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    loadStudent()
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function sendMessage(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSending(true);

    try {
      const response = await mentorApi.sendStudentMessage(id, message);
      setMessage(emptyMessage);
      setNotice(emailStatusMessage(response.data?.emailDeliveryStatus));
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  }

  async function approveGraduation(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setApproving(true);

    try {
      const response = await mentorApi.approveGraduation(id, {
        mentorNotes: graduationNotes
      });
      setDetails((current) => ({
        ...current,
        graduationCertificate: response.data
      }));
      setGraduationNotes("");
      setNotice("Graduation recommendation sent to admin for certificate review.");
    } catch (approveError) {
      setError(approveError.message);
    } finally {
      setApproving(false);
    }
  }

  const student = details?.student;
  const progress = details?.progress;
  const systemProgress = details?.systemProgress;
  const graduationCertificate = details?.graduationCertificate;
  const canRecommendGraduation = !graduationCertificate || graduationCertificate.status === "mentorApproved";
  const graduationReady = Boolean(systemProgress?.graduationReady);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          actions={<Button as={Link} icon={ArrowLeft} to="/students" variant="secondary">Back</Button>}
          description="Loading mentee profile and progress."
          title="Mentee profile"
        />
        <Card>
          <p className="text-sm text-bybs-body">Loading...</p>
        </Card>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-6">
        <PageHeader
          actions={<Button as={Link} icon={ArrowLeft} to="/students" variant="secondary">Back</Button>}
          description="This mentee could not be opened."
          title="Mentee profile"
        />
        <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error || "Mentee not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<Button as={Link} icon={ArrowLeft} to="/students" variant="secondary">Back</Button>}
        description="Review profile details, assignment progress, recent activity, and send private support messages."
        title={student.name}
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {notice ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{notice}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {student.profileImage ? (
              <img
                alt={student.name}
                className="h-24 w-24 rounded-lg border border-bybs-border object-cover"
                src={student.profileImage}
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-bybs-border bg-bybs-pale text-xl font-semibold text-bybs-blue">
                {initials(student.name) || <UserRound className="h-8 w-8" />}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-bybs-navy">{student.name}</h2>
                <StatusBadge status={student.status} />
              </div>
              <div className="grid gap-2 text-sm text-bybs-body sm:grid-cols-2">
                <p><span className="font-medium text-bybs-navy">Email:</span> {student.email}</p>
                <p><span className="font-medium text-bybs-navy">Phone:</span> {formatInternationalPhone(student.phone) || "Not set"}</p>
                <p><span className="font-medium text-bybs-navy">Cohort:</span> {student.cohort?.title || "Unassigned"}</p>
                <p><span className="font-medium text-bybs-navy">Last login:</span> {formatDateTime(student.lastLogin)}</p>
              </div>
              {student.bio ? <SafeHtml className="text-sm text-bybs-body" html={student.bio} /> : null}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-bybs-navy">Private message</h2>
          <form className="mt-4 space-y-3" onSubmit={sendMessage}>
            <label className="block text-sm font-medium text-bybs-body" htmlFor="message-title">
              Subject
            </label>
            <input
              className="w-full rounded-md border border-bybs-border px-3 py-2 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale"
              id="message-title"
              maxLength={120}
              onChange={(event) => setMessage((current) => ({ ...current, title: event.target.value }))}
              required
              value={message.title}
            />
            <label className="block text-sm font-medium text-bybs-body" htmlFor="message-body">
              Message
            </label>
            <textarea
              className="min-h-36 w-full rounded-md border border-bybs-border px-3 py-2 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale"
              id="message-body"
              maxLength={3000}
              onChange={(event) => setMessage((current) => ({ ...current, message: event.target.value }))}
              required
              value={message.message}
            />
            <Button className="w-full sm:w-auto" disabled={sending} icon={sending ? Mail : Send} type="submit">
              {sending ? "Sending..." : "Send message"}
            </Button>
          </form>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Progress" value={`${progress?.progress || 0}%`} />
        <StatCard label="Submitted" value={`${progress?.submittedCount || 0}/${progress?.totalAssignments || 0}`} />
        <StatCard label="Reviewed" value={progress?.reviewedCount || 0} />
        <StatCard label="Pending" value={progress?.pendingCount || 0} />
      </div>

      <Card>
        <ProgressBar label="Assignment completion" value={progress?.progress || 0} />
      </Card>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-bybs-blue" />
              <h2 className="text-base font-semibold text-bybs-navy">Graduation approval</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-bybs-body">
              Recommend this mentee for final admin review when they have completed the program requirements.
            </p>
          </div>
          {graduationCertificate ? <StatusBadge status={graduationCertificate.status} /> : null}
        </div>

        <SystemProgressPanel progress={systemProgress} />

        {graduationCertificate ? (
          <div className="mt-4 rounded-md bg-bybs-pale p-4 text-sm text-bybs-body">
            <p className="font-semibold text-bybs-navy">
              {graduationCertificate.status === "issued"
                ? "Certificate issued"
                : graduationCertificate.status === "revoked"
                  ? "Certificate revoked"
                  : "Awaiting admin certificate review"}
            </p>
            <p className="mt-1">
              Recommended {formatDateTime(graduationCertificate.mentorApprovedAt)}
              {graduationCertificate.certificateNumber ? ` · ${graduationCertificate.certificateNumber}` : ""}
            </p>
            {graduationCertificate.mentorNotes ? (
              <SafeHtml className="mt-3 text-sm leading-6 text-bybs-body" html={graduationCertificate.mentorNotes} />
            ) : null}
          </div>
        ) : null}

        {canRecommendGraduation && graduationCertificate?.status !== "issued" ? (
          <form className="mt-4 space-y-3" onSubmit={approveGraduation}>
            <label className="block text-sm font-medium text-bybs-body" htmlFor="graduation-notes">
              Mentor notes for admin
            </label>
            <textarea
              className="min-h-28 w-full rounded-md border border-bybs-border px-3 py-2 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale"
              id="graduation-notes"
              maxLength={3000}
              onChange={(event) => setGraduationNotes(event.target.value)}
              placeholder="Summarize why this mentee is ready to graduate."
              value={graduationNotes}
            />
            <Button disabled={approving || !graduationReady} icon={approving ? ShieldCheck : Award} type="submit">
              {approving
                ? "Sending..."
                : !graduationReady
                  ? "Not ready yet"
                  : graduationCertificate
                    ? "Update recommendation"
                    : "Recommend for certificate"}
            </Button>
          </form>
        ) : null}
      </Card>

      <DataTable
        columns={[
          { key: "title", header: "Assignment", wrap: true },
          { key: "module", header: "Module", render: (row) => row.module?.title || "General" },
          { key: "postedBy", header: "Posted by", render: (row) => row.postedBy?.name || "BYBS" },
          { key: "dueDate", header: "Due", render: (row) => formatDate(row.dueDate) },
          { key: "submittedAt", header: "Submitted", render: (row) => formatDateTime(row.submittedAt) },
          { key: "score", header: "Score", render: (row) => (row.score === null ? "Not scored" : `${row.score}/${row.maxScore}`) },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.submissionStatus} /> }
        ]}
        emptyDescription="Published assignments for this mentee will appear here."
        emptyTitle="No assignments yet"
        rows={progress?.assignmentProgress || []}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <DataTable
          columns={[
            { key: "assignment", header: "Recent submission", render: (row) => row.assignment?.title || "Assignment" },
            { key: "submittedAt", header: "Submitted", render: (row) => formatDateTime(row.submittedAt) },
            { key: "score", header: "Score", render: (row) => (row.score == null ? "Not scored" : row.score) },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> }
          ]}
          emptyDescription="Recent mentee submissions will appear here."
          emptyTitle="No submissions yet"
          rows={details.recentSubmissions || []}
        />

        <DataTable
          columns={[
            { key: "startsAt", header: "Booking", render: (row) => formatDateTime(row.startsAt) },
            { key: "reason", header: "Reason", wrap: true },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> }
          ]}
          emptyDescription="Bookings between you and this mentee will appear here."
          emptyTitle="No bookings yet"
          rows={details.recentBookings || []}
        />
      </div>
    </div>
  );
}
