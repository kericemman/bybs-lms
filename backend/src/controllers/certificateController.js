import { Certificate } from "../models/Certificate.js";
import { User } from "../models/User.js";
import {
  certificatePublicData,
  createCertificateNumber,
  createVerificationCode,
  serializeCertificate
} from "../services/certificateService.js";
import { notifyUser } from "../services/portalNotificationService.js";
import { calculateStudentProgress } from "../services/progressService.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { sanitizePlainText } from "../utils/sanitizeRichText.js";

function certificatePopulate(query) {
  return query
    .populate("student", "name email phone status cohort profileImage")
    .populate("cohort", "title status")
    .populate("mentorApprovedBy", "name email")
    .populate("issuedBy", "name email role")
    .populate("revokedBy", "name email role");
}

async function populateCertificate(certificate) {
  await certificate.populate("student", "name email phone status cohort profileImage");
  await certificate.populate("cohort", "title status");
  await certificate.populate("mentorApprovedBy", "name email");
  await certificate.populate("issuedBy", "name email role");
  await certificate.populate("revokedBy", "name email role");
  return certificate;
}

function certificateSearchFilter(search = "") {
  const cleanSearch = sanitizePlainText(search).trim();
  if (!cleanSearch) return {};

  return {
    $or: [
      { certificateNumber: { $regex: cleanSearch, $options: "i" } },
      { verificationCode: { $regex: cleanSearch, $options: "i" } }
    ]
  };
}

async function uniqueCertificateIdentity() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const certificateNumber = createCertificateNumber();
    const verificationCode = createVerificationCode();
    const existing = await Certificate.exists({
      $or: [{ certificateNumber }, { verificationCode }]
    });

    if (!existing) {
      return { certificateNumber, verificationCode };
    }
  }

  throw new ApiError(500, "Could not generate a unique certificate number");
}

function progressSnapshot(progress) {
  if (!progress) return null;

  return {
    progress: progress.progress,
    graduationReady: progress.graduationReady,
    assignmentCompletionPercentage: progress.assignmentCompletionPercentage,
    scorePercentage: progress.scorePercentage,
    attendancePercentage: progress.attendancePercentage,
    punctualityPercentage: progress.punctualityPercentage,
    totalAssignments: progress.totalAssignments,
    submittedCount: progress.submittedCount,
    pendingCount: progress.pendingCount,
    approvedCount: progress.approvedCount,
    needsRevisionCount: progress.needsRevisionCount,
    lateSubmissionCount: progress.lateSubmissionCount,
    attendanceMarked: progress.attendanceMarked,
    attended: progress.attended,
    lateAttendanceCount: progress.lateAttendanceCount,
    computedAt: new Date()
  };
}

async function currentProgressForCertificate(certificate) {
  if (!certificate.student?._id || !certificate.student?.cohort) return null;

  try {
    return progressSnapshot(await calculateStudentProgress(certificate.student));
  } catch (error) {
    return {
      graduationReady: false,
      progress: 0,
      error: error.message,
      computedAt: new Date()
    };
  }
}

async function serializeCertificateForAdmin(certificate, options = {}) {
  const data = serializeCertificate(certificate, options);
  data.currentProgress = await currentProgressForCertificate(certificate);
  return data;
}

export const listAdminCertificates = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {
    ...certificateSearchFilter(req.query.search)
  };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.cohort) filter.cohort = req.query.cohort;
  if (req.query.student) filter.student = req.query.student;

  const [certificates, total] = await Promise.all([
    certificatePopulate(Certificate.find(filter))
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Certificate.countDocuments(filter)
  ]);

  const data = await Promise.all(
    certificates.map((certificate) => serializeCertificateForAdmin(certificate))
  );

  res.json(paginatedResponse({
    data,
    total,
    page,
    limit
  }));
});

export const issueCertificate = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findById(req.params.id);

  if (!certificate) {
    throw new ApiError(404, "Certificate request not found");
  }

  if (certificate.status === "revoked") {
    throw new ApiError(409, "Revoked certificates cannot be issued");
  }

  const student = await User.findOne({
    _id: certificate.student,
    role: "student",
    status: { $ne: "removed" }
  }).select("name email phone status cohort profileImage");

  if (!student) {
    throw new ApiError(404, "Mentee not found");
  }

  const currentProgress = await calculateStudentProgress(student);

  if (!currentProgress.graduationReady) {
    throw new ApiError(
      409,
      `Certificate cannot be issued yet. System progress is ${currentProgress.progress}% and the mentee is not graduation-ready.`
    );
  }

  if (!certificate.certificateNumber || !certificate.verificationCode) {
    Object.assign(certificate, await uniqueCertificateIdentity());
  }

  certificate.status = "issued";
  certificate.issuedBy = req.user._id;
  certificate.issuedAt = certificate.issuedAt || new Date();
  certificate.progressSnapshot = progressSnapshot(currentProgress);
  certificate.revokedBy = undefined;
  certificate.revokedAt = undefined;
  certificate.revokeReason = undefined;
  await certificate.save();

  await User.updateOne(
    { _id: certificate.student, role: "student", status: { $ne: "removed" } },
    { status: "completed" }
  );

  await populateCertificate(certificate);

  await notifyUser({
    recipient: certificate.student,
    portalRole: "student",
    notification: {
      title: "Your BYBS certificate is ready",
      message: "Congratulations. Your BYBS certificate has been issued and is ready to download from your mentee portal.",
      channel: "both",
      previewText: "Your BYBS certificate is ready to download.",
      ctaLabel: "Open certificate",
      ctaUrl: "/app/certificates",
      targetType: "certificate",
      targetRole: "student",
      targetLabel: certificate.certificateNumber,
      type: "system",
      readStatus: false
    }
  });

  const data = serializeCertificate(certificate, { includeHtml: true });
  data.currentProgress = progressSnapshot(currentProgress);
  res.json({ data });
});

export const revokeCertificate = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findById(req.params.id);

  if (!certificate) {
    throw new ApiError(404, "Certificate not found");
  }

  certificate.status = "revoked";
  certificate.revokedBy = req.user._id;
  certificate.revokedAt = new Date();
  certificate.revokeReason = sanitizePlainText(req.body.revokeReason || "Revoked by admin");
  await certificate.save();
  await populateCertificate(certificate);

  res.json({ data: await serializeCertificateForAdmin(certificate) });
});

export const listStudentCertificates = asyncHandler(async (req, res) => {
  const certificates = await certificatePopulate(
    Certificate.find({
      student: req.user._id,
      status: "issued"
    }).sort({ issuedAt: -1, updatedAt: -1 })
  );

  res.json({
    data: certificates.map((certificate) => serializeCertificate(certificate, { includeHtml: true }))
  });
});

export const verifyCertificate = asyncHandler(async (req, res) => {
  const certificate = await certificatePopulate(
    Certificate.findOne({ verificationCode: req.params.code.toUpperCase() })
  );

  if (!certificate) {
    throw new ApiError(404, "Certificate not found");
  }

  res.json({ data: certificatePublicData(certificate) });
});
