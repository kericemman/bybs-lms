import { Award, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, PageHeader, StatusBadge } from "@bybs/shared";
import { studentApi } from "../services/api.js";
import { formatDate } from "../utils/format.js";

function fileName(certificate) {
  return `${certificate.certificateNumber || "BYBS-certificate"}.html`;
}

function openCertificate(certificate) {
  const blob = new Blob([certificate.certificateHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function downloadCertificate(certificate) {
  const blob = new Blob([certificate.certificateHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName(certificate);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function svgImage(svg = "") {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function CertificatesPage() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    studentApi.listCertificates()
      .then((response) => setCertificates(response.data))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Download your verified BYBS completion certificate when admin has approved it."
        title="My certificates"
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}

      {loading ? (
        <Card>
          <p className="text-sm text-bybs-body">Loading certificates...</p>
        </Card>
      ) : null}

      {!loading && !certificates.length ? (
        <EmptyState
          description="Your certificate will appear here after your mentor recommends graduation and admin issues it."
          title="No certificate yet"
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {certificates.map((certificate) => (
          <Card key={certificate._id}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-bybs-blue" />
                  <h2 className="text-lg font-semibold text-bybs-navy">BYBS Certificate</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-bybs-body">
                  {certificate.greeting} Your verified certificate is ready to download and share.
                </p>
              </div>
              <StatusBadge status={certificate.status} />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="space-y-3 text-sm text-bybs-body">
                <p><span className="font-medium text-bybs-navy">Certificate number:</span> {certificate.certificateNumber}</p>
                <p><span className="font-medium text-bybs-navy">Cohort:</span> {certificate.cohort?.title || "BYBS Program"}</p>
                <p><span className="font-medium text-bybs-navy">Issued:</span> {formatDate(certificate.issuedAt)}</p>
                <p><span className="font-medium text-bybs-navy">Verification:</span> {certificate.verificationCode}</p>
              </div>
              {certificate.qrCodeSvg ? (
                <div className="w-fit rounded-md border border-bybs-border bg-white p-3">
                  <img alt="Certificate verification QR code" className="h-32 w-32" src={svgImage(certificate.qrCodeSvg)} />
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button icon={Download} onClick={() => downloadCertificate(certificate)} type="button">
                Download
              </Button>
              <Button icon={ExternalLink} onClick={() => openCertificate(certificate)} type="button" variant="secondary">
                Open
              </Button>
              <Button as="a" href={certificate.verificationUrl} icon={ShieldCheck} rel="noreferrer" target="_blank" variant="secondary">
                Verify
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
