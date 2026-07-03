import { ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Card, StatusBadge } from "@bybs/shared";
import { studentApi } from "../services/api.js";
import { formatDate } from "../utils/format.js";

export function VerifyCertificatePage() {
  const { code } = useParams();
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    studentApi.verifyCertificate(code)
      .then((response) => setCertificate(response.data))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [code]);

  const isValid = certificate?.valid;

  return (
    <main className="min-h-screen bg-bybs-soft px-4 py-8 text-bybs-body">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col justify-center">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link className="text-lg font-semibold text-bybs-blue" to="/">BYBS LMS</Link>
          <Button as="a" href="https://buildyourbestself.org/" icon={ExternalLink} rel="noreferrer" target="_blank" variant="secondary">
            Main website
          </Button>
        </div>

        <Card className="p-7">
          {loading ? (
            <p className="text-sm text-bybs-body">Checking certificate...</p>
          ) : null}

          {!loading && error ? (
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-bybs-blush text-bybs-rose">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-bybs-navy">Certificate not verified</h1>
                <p className="mt-2 text-sm leading-6 text-bybs-body">
                  This verification code was not found. Check the link or contact BYBS support if you believe this is an error.
                </p>
              </div>
              <StatusBadge status="notFound" />
            </div>
          ) : null}

          {!loading && certificate ? (
            <div className="space-y-6">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${isValid ? "bg-bybs-pale text-bybs-blue" : "bg-bybs-blush text-bybs-rose"}`}>
                {isValid ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold text-bybs-navy">
                    {isValid ? "Certificate verified" : "Certificate not valid"}
                  </h1>
                  <StatusBadge status={certificate.status} />
                </div>
                <p className="mt-2 text-sm leading-6 text-bybs-body">
                  This page confirms the certificate record held by Build Your Best Self LMS.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md bg-bybs-pale p-4">
                  <p className="text-xs font-semibold uppercase text-bybs-muted">Certificate number</p>
                  <p className="mt-1 text-sm font-semibold text-bybs-navy">{certificate.certificateNumber || "Not available"}</p>
                </div>
                <div className="rounded-md bg-bybs-pale p-4">
                  <p className="text-xs font-semibold uppercase text-bybs-muted">Issued date</p>
                  <p className="mt-1 text-sm font-semibold text-bybs-navy">{formatDate(certificate.issuedAt)}</p>
                </div>
                <div className="rounded-md bg-bybs-pale p-4">
                  <p className="text-xs font-semibold uppercase text-bybs-muted">Recipient</p>
                  <p className="mt-1 text-sm font-semibold text-bybs-navy">{certificate.studentName || "BYBS graduate"}</p>
                </div>
                <div className="rounded-md bg-bybs-pale p-4">
                  <p className="text-xs font-semibold uppercase text-bybs-muted">Program</p>
                  <p className="mt-1 text-sm font-semibold text-bybs-navy">{certificate.cohortTitle || "BYBS Program"}</p>
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
