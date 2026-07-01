import crypto from "node:crypto";
import { Assignment } from "../models/Assignment.js";
import { Booking } from "../models/Booking.js";
import { Cohort } from "../models/Cohort.js";
import { Discussion } from "../models/Discussion.js";
import { MentorAvailability } from "../models/MentorAvailability.js";
import { Notification } from "../models/Notification.js";
import { Report } from "../models/Report.js";
import { Resource } from "../models/Resource.js";
import { Session } from "../models/Session.js";
import { Submission } from "../models/Submission.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { SystemLog } from "../models/SystemLog.js";
import { User } from "../models/User.js";
import { sendUserWelcomeEmail } from "../services/userWelcomeEmailService.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseCsv } from "../utils/csv.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { sanitizePlainText, sanitizeRichText } from "../utils/sanitizeRichText.js";

function cleanUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    cohort: user.cohort,
    mentor: user.mentor,
    status: user.status,
    bio: user.bio,
    expertise: user.expertise,
    passwordResetRequired: Boolean(user.passwordResetRequired),
    passwordChangedAt: user.passwordChangedAt,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt
  };
}

async function syncCohortMembership(user, previousCohortId = null) {
  if (previousCohortId && String(previousCohortId) !== String(user.cohort || "")) {
    await Cohort.findByIdAndUpdate(previousCohortId, {
      $pull: user.role === "mentor" ? { mentors: user._id } : { students: user._id }
    });
  }

  if (!user.cohort || !["student", "mentor"].includes(user.role)) {
    return;
  }

  await Cohort.findByIdAndUpdate(user.cohort, {
    $addToSet: user.role === "mentor" ? { mentors: user._id } : { students: user._id }
  });
}

function temporaryPassword() {
  return `BYBS-${crypto.randomBytes(9).toString("base64url")}!`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveCohort(value) {
  if (!value) return undefined;
  if (/^[0-9a-fA-F]{24}$/.test(value)) return value;

  const cohort = await Cohort.findOne({ title: { $regex: `^${escapeRegex(value)}$`, $options: "i" } });
  return cohort?._id;
}

async function resolveMentor(value) {
  if (!value) return undefined;
  if (/^[0-9a-fA-F]{24}$/.test(value)) return value;

  const mentor = await User.findOne({
    role: "mentor",
    $or: [
      { email: value.toLowerCase() },
      { name: { $regex: `^${escapeRegex(value)}$`, $options: "i" } }
    ]
  });
  return mentor?._id;
}

function isSameUser(left, right) {
  return String(left || "") === String(right || "");
}

async function assertSuperAdminCanBeDeactivated(user) {
  if (user.role !== "superAdmin") return;

  const activeSuperAdmins = await User.countDocuments({
    _id: { $ne: user._id },
    role: "superAdmin",
    status: "active"
  });

  if (activeSuperAdmins < 1) {
    throw new ApiError(400, "At least one active super admin must remain");
  }
}

async function getMentorHistoryCounts(mentorId) {
  const [
    bookings,
    reports,
    assignments,
    resources,
    discussions,
    submissions,
    sessions,
    supportTickets
  ] = await Promise.all([
    Booking.countDocuments({ mentor: mentorId }),
    Report.countDocuments({ mentor: mentorId }),
    Assignment.countDocuments({ createdBy: mentorId }),
    Resource.countDocuments({ uploadedBy: mentorId }),
    Discussion.countDocuments({
      $or: [{ createdBy: mentorId }, { "comments.createdBy": mentorId }, { "comments.reactions": mentorId }]
    }),
    Submission.countDocuments({ reviewedBy: mentorId }),
    Session.countDocuments({ "attendance.markedBy": mentorId }),
    SupportTicket.countDocuments({ $or: [{ assignedTo: mentorId }, { "replies.createdBy": mentorId }] })
  ]);

  return {
    bookings,
    reports,
    assignments,
    resources,
    discussions,
    submissions,
    sessions,
    supportTickets
  };
}

function summarizeMentorHistory(counts) {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${count} ${key}`)
    .join(", ");
}

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.cohort) filter.cohort = req.query.cohort;
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: "i" } },
      { email: { $regex: req.query.search, $options: "i" } }
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .populate("cohort", "title status")
      .populate("mentor", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: users.map(cleanUser), total, page, limit }));
});

export const createUser = asyncHandler(async (req, res) => {
  if (["admin", "superAdmin"].includes(req.body.role) && req.user.role !== "superAdmin") {
    throw new ApiError(403, "Only a super admin can create admin-level accounts");
  }

  const existingUser = await User.findOne({ email: req.body.email.toLowerCase() });

  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists");
  }

  const { password, welcomeEmail, ...userInput } = req.body;
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    ...sanitizeUserPayload(userInput),
    email: req.body.email.toLowerCase(),
    passwordHash,
    passwordResetRequired: true
  });

  await syncCohortMembership(user);

  const populatedUser = await User.findById(user._id)
    .populate("cohort", "title status")
    .populate("mentor", "name email");

  let welcomeEmailStatus = "notRequested";
  let welcomeEmailError = "";

  if (["mentor", "admin", "superAdmin"].includes(user.role) && welcomeEmail?.send !== false) {
    const delivery = await sendUserWelcomeEmail({ user: populatedUser, password, welcomeEmail });
    welcomeEmailStatus = delivery.status;
    welcomeEmailError = delivery.error || "";
  }

  res.status(201).json({
    data: cleanUser(populatedUser),
    meta: {
      welcomeEmailStatus,
      welcomeEmailError
    }
  });
});

export const importStudents = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "CSV file is required");
  }

  const rows = parseCsv(req.file.buffer.toString("utf8"));
  const created = [];
  const skipped = [];
  const errors = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const email = row.email?.toLowerCase();

    try {
      if (!row.name || !email) {
        errors.push({ row: rowNumber, message: "Name and email are required" });
        continue;
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        skipped.push({ row: rowNumber, email, reason: "Email already exists" });
        continue;
      }

      const cohort = await resolveCohort(row.cohort);
      const mentor = await resolveMentor(row.mentor);
      const password = row.password || temporaryPassword();

      if (password.length < 12) {
        errors.push({ row: rowNumber, email, message: "Password must be at least 12 characters" });
        continue;
      }

      const user = await User.create({
        name: sanitizePlainText(row.name),
        email,
        phone: sanitizePlainText(row.phone || "") || undefined,
        role: "student",
        cohort,
        mentor,
        status: row.status || "active",
        passwordHash: await User.hashPassword(password),
        passwordResetRequired: true
      });

      await syncCohortMembership(user);
      created.push({ id: user.id, name: user.name, email: user.email });
    } catch (error) {
      errors.push({ row: rowNumber, email, message: error.message || "Import failed" });
    }
  }

  res.status(201).json({
    data: {
      created,
      skipped,
      errors,
      totalRows: rows.length
    }
  });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (["admin", "superAdmin"].includes(user.role) && req.user.role !== "superAdmin") {
    throw new ApiError(403, "Only a super admin can update admin-level accounts");
  }

  if (isSameUser(user._id, req.user._id) && req.body.status && req.body.status !== user.status) {
    throw new ApiError(400, "You cannot change your own account status");
  }

  if (req.body.status && req.body.status !== "active") {
    await assertSuperAdminCanBeDeactivated(user);
  }

  const previousCohortId = user.cohort;
  Object.assign(user, sanitizeUserPayload(req.body));
  await user.save();
  await syncCohortMembership(user, previousCohortId);

  const populatedUser = await User.findById(user._id)
    .populate("cohort", "title status")
    .populate("mentor", "name email");

  res.json({ data: cleanUser(populatedUser) });
});

function sanitizeUserPayload(payload) {
  const nextPayload = { ...payload };

  if (Object.prototype.hasOwnProperty.call(nextPayload, "name")) {
    nextPayload.name = sanitizePlainText(nextPayload.name);
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, "phone")) {
    nextPayload.phone = sanitizePlainText(nextPayload.phone || "");
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, "bio")) {
    nextPayload.bio = sanitizeRichText(nextPayload.bio || "");
  }

  if (Array.isArray(nextPayload.expertise)) {
    nextPayload.expertise = nextPayload.expertise.map((item) => sanitizePlainText(item)).filter(Boolean);
  }

  return nextPayload;
}

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (isSameUser(user._id, req.user._id)) {
    throw new ApiError(400, "You cannot remove your own account");
  }

  if (["admin", "superAdmin"].includes(user.role) && req.user.role !== "superAdmin") {
    throw new ApiError(403, "Only a super admin can remove admin-level accounts");
  }

  await assertSuperAdminCanBeDeactivated(user);

  user.status = "removed";
  await user.save();

  if (user.cohort && ["student", "mentor"].includes(user.role)) {
    await Cohort.findByIdAndUpdate(user.cohort, {
      $pull: user.role === "mentor" ? { mentors: user._id } : { students: user._id }
    });
  }

  res.json({ data: { id: user.id, status: user.status, deleted: true } });
});

export const permanentlyDeleteMentor = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new ApiError(404, "Mentor not found");
  }

  if (user.role !== "mentor") {
    throw new ApiError(400, "Only mentor accounts can be permanently deleted from this action");
  }

  if (user.status !== "removed") {
    throw new ApiError(409, "Remove this mentor first before deleting permanently");
  }

  const historyCounts = await getMentorHistoryCounts(user._id);
  const historySummary = summarizeMentorHistory(historyCounts);

  if (historySummary) {
    throw new ApiError(
      409,
      `This mentor has history (${historySummary}). Keep the account removed instead of permanently deleting it.`
    );
  }

  await Promise.all([
    Cohort.updateMany({ mentors: user._id }, { $pull: { mentors: user._id } }),
    User.updateMany({ mentor: user._id }, { $unset: { mentor: "" } }),
    MentorAvailability.deleteMany({ mentor: user._id }),
    Notification.deleteMany({ recipient: user._id }),
    SystemLog.updateMany({ user: user._id }, { $unset: { user: "" } })
  ]);

  await user.deleteOne();

  res.json({ data: { id: req.params.id, deleted: true, permanent: true } });
});
