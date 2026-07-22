import crypto from "node:crypto";
import { BetaApplication } from "../models/BetaApplication.js";
import { User } from "../models/User.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { sanitizePlainText, sanitizeRichText } from "../utils/sanitizeRichText.js";
import { sendBetaAcceptanceEmail } from "../services/betaAcceptanceEmailService.js";

function searchRegex(search) {
  return { $regex: search, $options: "i" };
}

function cleanApplication(application) {
  return {
    id: application.id,
    _id: application._id,
    applicantType: application.applicantType,
    name: application.name,
    email: application.email,
    phone: application.phone,
    location: application.location,
    experienceLevel: application.experienceLevel,
    availability: application.availability,
    motivation: application.motivation,
    source: application.source,
    consent: application.consent,
    status: application.status,
    adminNotes: application.adminNotes,
    reviewedBy: application.reviewedBy,
    reviewedAt: application.reviewedAt,
    acceptanceEmailStatus: application.acceptanceEmailStatus,
    acceptanceEmailError: application.acceptanceEmailError,
    acceptanceEmailSentAt: application.acceptanceEmailSentAt,
    testerUser: application.testerUser,
    testerAccountStatus: application.testerAccountStatus,
    testerAccountError: application.testerAccountError,
    testerAccountCreatedAt: application.testerAccountCreatedAt,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt
  };
}

function sanitizeApplicationPayload(payload) {
  return {
    ...payload,
    applicantType: payload.applicantType,
    name: sanitizePlainText(payload.name),
    email: sanitizePlainText(payload.email).toLowerCase(),
    phone: sanitizePlainText(payload.phone || ""),
    location: sanitizePlainText(payload.location || ""),
    availability: sanitizePlainText(payload.availability || ""),
    motivation: sanitizeRichText(payload.motivation),
    source: sanitizePlainText(payload.source || ""),
    consent: payload.consent === true
  };
}

function temporaryPassword() {
  return `BYBS-${crypto.randomBytes(9).toString("base64url")}!`;
}

function testerPortalUrl(applicantType) {
  return applicantType === "mentor" ? env.clientMentorUrl : env.clientStudentUrl;
}

async function prepareTesterAccess(application) {
  const email = application.email.toLowerCase();
  const role = application.applicantType;
  const password = temporaryPassword();
  const linkedUser = application.testerUser ? await User.findById(application.testerUser).select("+passwordHash") : null;
  const existingUser = linkedUser || await User.findOne({ email }).select("+passwordHash");

  if (existingUser) {
    if (existingUser.role !== role) {
      throw new Error(`A ${existingUser.role} account already uses this email.`);
    }

    if (existingUser.status !== "active") {
      throw new Error(`The matching ${role} account is ${existingUser.status}. Reactivate it before sending beta access.`);
    }

    application.testerUser = existingUser._id;

    if (application.testerAccountStatus === "created" || linkedUser) {
      existingUser.passwordHash = await User.hashPassword(password);
      existingUser.passwordResetRequired = true;
      await existingUser.save();
      application.testerAccountStatus = "created";
      application.testerAccountError = "";
      application.testerAccountCreatedAt = application.testerAccountCreatedAt || new Date();

      return {
        status: "created",
        user: existingUser,
        password,
        loginUrl: testerPortalUrl(role)
      };
    }

    application.testerAccountStatus = "existing";
    application.testerAccountError = "";

    return {
      status: "existing",
      user: existingUser,
      loginUrl: testerPortalUrl(role)
    };
  }

  const user = await User.create({
    name: application.name,
    email,
    phone: application.phone || undefined,
    role,
    status: "active",
    passwordHash: await User.hashPassword(password),
    passwordResetRequired: true
  });

  application.testerUser = user._id;
  application.testerAccountStatus = "created";
  application.testerAccountError = "";
  application.testerAccountCreatedAt = new Date();

  return {
    status: "created",
    user,
    password,
    loginUrl: testerPortalUrl(role)
  };
}

async function deliverAcceptanceEmail(application) {
  let testerAccess;

  try {
    testerAccess = await prepareTesterAccess(application);
  } catch (error) {
    const message = error.message || "Tester account could not be prepared";
    application.testerAccountStatus = "failed";
    application.testerAccountError = message;
    application.acceptanceEmailStatus = "failed";
    application.acceptanceEmailError = `Tester access could not be prepared: ${message}`;
    await application.save();
    return {
      status: "failed",
      error: application.acceptanceEmailError
    };
  }

  const emailResult = await sendBetaAcceptanceEmail(application, testerAccess);
  application.acceptanceEmailStatus = emailResult.status;
  application.acceptanceEmailError = emailResult.error || "";

  if (emailResult.status === "sent") {
    application.acceptanceEmailSentAt = new Date();
  }

  await application.save();
  return emailResult;
}

function acceptanceEmailFailureMessage(application) {
  if (application.acceptanceEmailStatus === "notConfigured") {
    return "Acceptance email was not sent because the email provider is not configured.";
  }

  if (application.acceptanceEmailStatus === "failed") {
    return application.acceptanceEmailError || "Acceptance email failed to send.";
  }

  return "";
}

export const createBetaApplication = asyncHandler(async (req, res) => {
  if (!env.betaFeaturesEnabled) {
    throw new ApiError(410, "Beta testing applications are now closed.");
  }

  const payload = sanitizeApplicationPayload(req.body);
  const existingApplication = await BetaApplication.findOne({
    email: payload.email,
    applicantType: payload.applicantType
  });

  if (existingApplication) {
    res.status(200).json({
      data: {
        id: existingApplication.id,
        status: existingApplication.status,
        alreadyApplied: true
      }
    });
    return;
  }

  const application = await BetaApplication.create(payload);

  res.status(201).json({
    data: {
      id: application.id,
      status: application.status,
      alreadyApplied: false
    }
  });
});

export const listBetaApplications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

  if (req.query.applicantType) filter.applicantType = req.query.applicantType;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    filter.$or = [
      { name: searchRegex(req.query.search) },
      { email: searchRegex(req.query.search) },
      { phone: searchRegex(req.query.search) },
      { motivation: searchRegex(req.query.search) }
    ];
  }

  const [applications, total] = await Promise.all([
    BetaApplication.find(filter)
      .populate("reviewedBy", "name email role")
      .populate("testerUser", "name email role status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    BetaApplication.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: applications.map(cleanApplication), total, page, limit }));
});

export const updateBetaApplication = asyncHandler(async (req, res) => {
  const application = await BetaApplication.findById(req.params.id);

  if (!application) {
    throw new ApiError(404, "Beta application not found");
  }

  const wasAccepted = application.status === "accepted";
  const willAccept = req.body.status === "accepted";

  if (willAccept && !env.betaFeaturesEnabled) {
    throw new ApiError(410, "Beta acceptance is closed. Manage Cohort 4 users from the live mentees and mentors sections.");
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
    application.status = req.body.status;
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "adminNotes")) {
    application.adminNotes = sanitizeRichText(req.body.adminNotes || "");
  }

  await application.save();

  if (willAccept && (!wasAccepted || application.acceptanceEmailStatus !== "sent")) {
    await deliverAcceptanceEmail(application);
  }

  await application.populate("reviewedBy", "name email role");
  await application.populate("testerUser", "name email role status");

  res.json({ data: cleanApplication(application) });
});

export const sendBetaApplicationAcceptanceEmail = asyncHandler(async (req, res) => {
  if (!env.betaFeaturesEnabled) {
    throw new ApiError(410, "Beta acceptance emails are closed. Manage Cohort 4 users from the live mentees and mentors sections.");
  }

  const application = await BetaApplication.findById(req.params.id);

  if (!application) {
    throw new ApiError(404, "Beta application not found");
  }

  if (application.status !== "accepted") {
    throw new ApiError(409, "Accept this application before sending the acceptance email.");
  }

  await deliverAcceptanceEmail(application);
  await application.populate("reviewedBy", "name email role");
  await application.populate("testerUser", "name email role status");

  if (application.acceptanceEmailStatus !== "sent") {
    throw new ApiError(
      424,
      acceptanceEmailFailureMessage(application),
      { application: cleanApplication(application) }
    );
  }

  res.json({ data: cleanApplication(application) });
});

export const deleteBetaApplication = asyncHandler(async (req, res) => {
  const application = await BetaApplication.findById(req.params.id);

  if (!application) {
    throw new ApiError(404, "Beta application not found");
  }

  await application.deleteOne();
  res.json({ data: { id: req.params.id, deleted: true } });
});
