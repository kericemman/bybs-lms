import { Award, CheckCircle2, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, DataTable, PageHeader, ProgressBar, SafeHtml, StatCard, StatusBadge } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { adminApi } from "../services/api.js";
import { formatDateTime, relatedTitle } from "../utils/format.js";
import { hasRole } from "../utils/permissions.js";

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "mentorApproved", label: "Awaiting admin" },
  { value: "issued", label: "Issued" },
  { value: "revoked", label: "Revoked" }
];

function certificateProgress(certificate) {
  return certificate?.currentProgress || certificate?.progressSnapshot || null;
}

function isCertificateReady(certificate) {
  return Boolean(certificateProgress(certificate)?.graduationReady);
}

function ProgressEvidence({ progress }) {
  if (!progress) {
    return (
      <div className="mt-5 rounded-md border border-bybs-border p-4">
        <p className="text-sm font-semibold text-bybs-navy">System progress check</p>
        <p className="mt-2 text-sm text-bybs-body">Progress evidence is not available yet.</p>
      </div>
    );
  }

  const values = [
    ["Assignment completion", progress.assignmentCompletionPercentage],
    ["Approved score", progress.scorePercentage],
    ["Attendance", progress.attendancePercentage],
    ["Punctuality", progress.punctualityPercentage]
  ];

  return (
    <div className="mt-5 rounded-md border border-bybs-border p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-bybs-navy">System progress check</p>
          <p className="mt-1 text-sm text-bybs-body">
            Certificates can only be issued when the computed progress is graduation-ready.
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

      <div className="mt-4">
        <ProgressBar label="Overall progress" value={progress.progress || 0} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {values.map(([label, value]) => (
          <div className="rounded-md bg-bybs-pale p-3" key={label}>
            <ProgressBar label={label} value={value || 0} />
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Submitted", `${progress.submittedCount || 0}/${progress.totalAssignments || 0}`],
          ["Pending", progress.pendingCount || 0],
          ["Late submissions", progress.lateSubmissionCount || 0],
          ["Attendance marked", progress.attendanceMarked || 0],
          ["Attended", progress.attended || 0],
          ["Needs revision", progress.needsRevisionCount || 0]
        ].map(([label, value]) => (
          <div className="rounded-md border border-bybs-border bg-white p-3" key={label}>
            <p className="text-xs font-medium uppercase text-bybs-muted">{label}</p>
            <p className="mt-1 text-sm font-semibold text-bybs-navy">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CertificatesPage() {
  const { user } = useAuth();
  const canIssue = hasRole(user, ["admin", "superAdmin"]);
  const [certificates, setCertificates] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  async function loadCertificates(nextFilters = filters) {
    const response = await adminApi.listCertificates(nextFilters);
    setCertificates(response.data);
    setSelectedCertificate((current) =>
      current ? response.data.find((certificate) => certificate._id === current._id) || current : current
    );
  }

  useEffect(() => {
    setLoading(true);
    loadCertificates()
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    total: certificates.length,
    pending: certificates.filter((certificate) => certificate.status === "mentorApproved").length,
    ready: certificates.filter((certificate) => certificate.status === "mentorApproved" && isCertificateReady(certificate)).length,
    issued: certificates.filter((certificate) => certificate.status === "issued").length,
    revoked: certificates.filter((certificate) => certificate.status === "revoked").length
  }), [certificates]);

  async function applyFilters(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setLoading(true);

    try {
      await loadCertificates(filters);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function issueCertificate(certificate) {
    setError("");
    setFeedback("");
    setWorkingId(certificate._id);

    try {
      const response = await adminApi.issueCertificate(certificate._id);
      setSelectedCertificate(response.data);
      setFeedback(`Certificate issued for ${relatedTitle(response.data.student, "mentee")}.`);
      await loadCertificates(filters);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorkingId("");
    }
  }

  async function revokeCertificate(certificate) {
    if (!window.confirm("Revoke this certificate? The public verification page will show it as not valid.")) return;

    setError("");
    setFeedback("");
    setWorkingId(certificate._id);

    try {
      const response = await adminApi.revokeCertificate(certificate._id, {
        revokeReason: "Revoked by admin"
      });
      setSelectedCertificate(response.data);
      setFeedback(`Certificate revoked for ${relatedTitle(response.data.student, "mentee")}.`);
      await loadCertificates(filters);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorkingId("");
    }
  }

  function selectCertificate(certificate) {
    setSelectedCertificate(certificate);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review mentor graduation recommendations and issue verified BYBS completion certificates."
        title="Certificates"
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      <div className="grid gap-4 md:grid-cols-5">
        <StatCard icon={Award} label="Total" value={counts.total} />
        <StatCard icon={ShieldCheck} label="Awaiting admin" value={counts.pending} />
        <StatCard icon={CheckCircle2} label="System ready" value={counts.ready} />
        <StatCard icon={CheckCircle2} label="Issued" value={counts.issued} />
        <StatCard icon={RotateCcw} label="Revoked" value={counts.revoked} />
      </div>

      {selectedCertificate ? (
        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-bybs-blue">Certificate review</p>
              <h2 className="mt-1 text-lg font-semibold text-bybs-navy">
                {relatedTitle(selectedCertificate.student, "Mentee")}
              </h2>
              <p className="mt-1 text-sm text-bybs-body">
                {relatedTitle(selectedCertificate.cohort, "Cohort")} · Recommended by {relatedTitle(selectedCertificate.mentorApprovedBy, "mentor")}
              </p>
            </div>
            <StatusBadge status={selectedCertificate.status} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-md bg-bybs-pale p-4">
              <p className="text-sm text-bybs-muted">Recommended</p>
              <p className="mt-1 text-sm font-semibold text-bybs-navy">{formatDateTime(selectedCertificate.mentorApprovedAt)}</p>
            </div>
            <div className="rounded-md bg-bybs-pale p-4">
              <p className="text-sm text-bybs-muted">Issued</p>
              <p className="mt-1 text-sm font-semibold text-bybs-navy">{formatDateTime(selectedCertificate.issuedAt)}</p>
            </div>
            <div className="rounded-md bg-bybs-pale p-4">
              <p className="text-sm text-bybs-muted">Certificate no.</p>
              <p className="mt-1 text-sm font-semibold text-bybs-navy">{selectedCertificate.certificateNumber || "Not issued"}</p>
            </div>
          </div>

          <ProgressEvidence progress={certificateProgress(selectedCertificate)} />

          {selectedCertificate.mentorNotes ? (
            <div className="mt-5 rounded-md border border-bybs-border p-4">
              <p className="text-sm font-semibold text-bybs-navy">Mentor notes</p>
              <SafeHtml className="mt-2 text-sm leading-6 text-bybs-body" html={selectedCertificate.mentorNotes} />
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {canIssue && selectedCertificate.status === "mentorApproved" ? (
              <Button
                disabled={workingId === selectedCertificate._id || !isCertificateReady(selectedCertificate)}
                icon={CheckCircle2}
                onClick={() => issueCertificate(selectedCertificate)}
                type="button"
              >
                {workingId === selectedCertificate._id
                  ? "Issuing..."
                  : isCertificateReady(selectedCertificate)
                    ? "Issue certificate"
                    : "Not ready yet"}
              </Button>
            ) : null}
            {canIssue && selectedCertificate.status === "issued" ? (
              <Button
                disabled={workingId === selectedCertificate._id}
                icon={RotateCcw}
                onClick={() => revokeCertificate(selectedCertificate)}
                type="button"
                variant="danger"
              >
                {workingId === selectedCertificate._id ? "Revoking..." : "Revoke certificate"}
              </Button>
            ) : null}
            {selectedCertificate.verificationUrl ? (
              <Button as="a" href={selectedCertificate.verificationUrl} target="_blank" rel="noreferrer" variant="secondary">
                Open verification
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card>
        <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]" onSubmit={applyFilters}>
          <input
            className="w-full rounded-md border border-bybs-border px-3 py-2 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale"
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Search certificate number or code"
            value={filters.search}
          />
          <select
            className="w-full rounded-md border border-bybs-border px-3 py-2 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale"
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            value={filters.status}
          >
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <Button disabled={loading} icon={Search} type="submit" variant="secondary">
            {loading ? "Loading..." : "Filter"}
          </Button>
        </form>
      </Card>

      <DataTable
        columns={[
          { key: "student", header: "Mentee", render: (row) => relatedTitle(row.student, "Mentee") },
          { key: "cohort", header: "Cohort", render: (row) => relatedTitle(row.cohort) },
          { key: "mentorApprovedBy", header: "Mentor", render: (row) => relatedTitle(row.mentorApprovedBy, "Mentor") },
          { key: "mentorApprovedAt", header: "Recommended", render: (row) => formatDateTime(row.mentorApprovedAt) },
          {
            key: "progress",
            header: "Progress",
            render: (row) => <div className="w-36"><ProgressBar value={certificateProgress(row)?.progress || 0} /></div>
          },
          {
            key: "readiness",
            header: "System check",
            render: (row) => (
              <StatusBadge
                label={isCertificateReady(row) ? "Ready" : "Not ready"}
                status={isCertificateReady(row) ? "approved" : "pending"}
              />
            )
          },
          { key: "certificateNumber", header: "Certificate no.", render: (row) => row.certificateNumber || "Not issued" },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => selectCertificate(row)} size="sm" type="button" variant="secondary">
                  View
                </Button>
                {canIssue && row.status === "mentorApproved" ? (
                  <Button
                    disabled={workingId === row._id || !isCertificateReady(row)}
                    icon={CheckCircle2}
                    onClick={() => issueCertificate(row)}
                    size="sm"
                    type="button"
                  >
                    {isCertificateReady(row) ? "Issue" : "Not ready"}
                  </Button>
                ) : null}
              </div>
            )
          }
        ]}
        emptyDescription="Mentor graduation recommendations will appear here after mentors approve mentees for graduation."
        emptyTitle="No certificate requests yet"
        rows={certificates}
      />
    </div>
  );
}
