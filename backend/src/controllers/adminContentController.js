import crypto from "node:crypto";
import { Assignment } from "../models/Assignment.js";
import { Booking } from "../models/Booking.js";
import { Cohort } from "../models/Cohort.js";
import { Discussion } from "../models/Discussion.js";
import { Module } from "../models/Module.js";
import { Notification } from "../models/Notification.js";
import { Report } from "../models/Report.js";
import { Resource } from "../models/Resource.js";
import { Session } from "../models/Session.js";
import { Submission } from "../models/Submission.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { SystemLog } from "../models/SystemLog.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { sanitizePlainText, sanitizeRichText } from "../utils/sanitizeRichText.js";
import {
  personalizeAnnouncementForRecipient,
  sendAnnouncementEmails
} from "../services/announcementEmailService.js";
import { notifyUser } from "../services/portalNotificationService.js";

function searchRegex(search) {
  return { $regex: search, $options: "i" };
}

const ADMIN_MANAGER_ANNOUNCEMENT_ROLES = ["student", "mentor"];

async function listCollection({ model, req, filter = {}, populate = [], sort = { createdAt: -1 } }) {
  const { page, limit, skip } = getPagination(req.query);
  const [data, total] = await Promise.all([
    populate
      .reduce((query, item) => query.populate(item), model.find(filter))
      .sort(sort)
      .skip(skip)
      .limit(limit),
    model.countDocuments(filter)
  ]);

  return paginatedResponse({ data, total, page, limit });
}

function applySharedFilters(req, filter) {
  if (req.query.cohort) filter.cohort = req.query.cohort;
  if (req.query.module) filter.module = req.query.module;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) filter.title = searchRegex(req.query.search);
}

async function resolveAnnouncementTargetLabel({ targetType, cohort, role, recipient }) {
  if (targetType === "all") return "All active users";
  if (targetType === "role") return `${role} role`;

  if (targetType === "cohort" && cohort) {
    const targetCohort = await Cohort.findById(cohort).select("title");
    return targetCohort?.title || "Selected cohort";
  }

  if (targetType === "user" && recipient) {
    const targetUser = await User.findById(recipient).select("name email");
    return targetUser?.name || targetUser?.email || "Selected user";
  }

  return "Selected target";
}

async function validateModuleMentor({ assignedMentor, cohort }) {
  if (!assignedMentor) return;

  const [mentor, targetCohort] = await Promise.all([
    User.findOne({ _id: assignedMentor, role: "mentor", status: { $ne: "removed" } }).select("_id cohort"),
    Cohort.findById(cohort).select("mentors")
  ]);

  if (!mentor) {
    throw new ApiError(400, "Assigned mentor must be an active mentor account");
  }

  if (!targetCohort) {
    throw new ApiError(400, "Cohort not found");
  }

  const mentorInCohort =
    String(mentor.cohort || "") === String(cohort) ||
    targetCohort.mentors.some((mentorId) => String(mentorId) === String(assignedMentor));

  if (!mentorInCohort) {
    throw new ApiError(400, "Assigned mentor must belong to the selected cohort");
  }
}

function validateModuleDates({ startDate, endDate }) {
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw new ApiError(400, "Module end date must be after the start date");
  }
}

function catDateParts(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Maputo",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function catSessionDate(year, month, day, hour) {
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), hour - 2, 0, 0, 0));
}

function catDateValue(value) {
  const parts = catDateParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function weekendCatSessionWindows(startDate, endDate) {
  const startValue = catDateValue(startDate);
  const endValue = catDateValue(endDate || startDate);
  const [startYear, startMonth, startDay] = startValue.split("-").map((part) => Number(part));
  const [endYear, endMonth, endDay] = endValue.split("-").map((part) => Number(part));
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay, 12, 0, 0, 0));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay, 12, 0, 0, 0));
  const windows = [];

  while (cursor <= end) {
    const day = cursor.getUTCDay();

    if (day === 0 || day === 6) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth() + 1;
      const date = cursor.getUTCDate();
      windows.push({
        startsAt: catSessionDate(year, month, date, 14),
        endsAt: catSessionDate(year, month, date, 16)
      });
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return windows;
}

function normalizeCatSessionWindow(startsAt) {
  const parts = catDateParts(startsAt);
  const weekday = String(parts.weekday || "").toLowerCase();

  if (!["saturday", "sunday"].includes(weekday)) {
    throw new ApiError(400, "BYBS sessions must be scheduled on Saturday or Sunday.");
  }

  return {
    startsAt: catSessionDate(parts.year, parts.month, parts.day, 14),
    endsAt: catSessionDate(parts.year, parts.month, parts.day, 16)
  };
}

async function validateSessionModule({ cohort, module }) {
  if (!module) {
    throw new ApiError(400, "Choose the module this session belongs to.");
  }

  const sessionModule = await Module.findById(module)
    .select("cohort assignedMentor")
    .populate("assignedMentor", "name email role status");

  if (!sessionModule) {
    throw new ApiError(400, "Session module was not found.");
  }

  if (String(sessionModule.cohort || "") !== String(cohort || "")) {
    throw new ApiError(400, "Session module must belong to the selected cohort.");
  }

  if (!sessionModule.assignedMentor) {
    throw new ApiError(400, "Assign a mentor to this module before creating a session.");
  }
}

function sessionPopulate() {
  return [
    { path: "cohort", select: "title status" },
    {
      path: "module",
      select: "title status assignedMentor startDate endDate",
      populate: { path: "assignedMentor", select: "name email role status profileImage" }
    }
  ];
}

function sanitizeResourcePayload(payload) {
  const nextPayload = { ...payload };

  if (Object.prototype.hasOwnProperty.call(nextPayload, "title")) {
    nextPayload.title = sanitizePlainText(nextPayload.title);
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, "description")) {
    nextPayload.description = sanitizeRichText(nextPayload.description || "");
  }

  return nextPayload;
}

function sanitizeModulePayload(payload) {
  const nextPayload = { ...payload };

  if (Object.prototype.hasOwnProperty.call(nextPayload, "title")) {
    nextPayload.title = sanitizePlainText(nextPayload.title);
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, "description")) {
    nextPayload.description = sanitizeRichText(nextPayload.description || "");
  }

  return nextPayload;
}

function sanitizeSessionPayload(payload) {
  const nextPayload = { ...payload };

  if (Object.prototype.hasOwnProperty.call(nextPayload, "title")) {
    nextPayload.title = sanitizePlainText(nextPayload.title);
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, "description")) {
    nextPayload.description = sanitizeRichText(nextPayload.description || "");
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, "startsAt") && nextPayload.startsAt) {
    Object.assign(nextPayload, normalizeCatSessionWindow(nextPayload.startsAt));
  }

  return nextPayload;
}

function sanitizeBookingPayload(payload) {
  const nextPayload = { ...payload };

  if (Object.prototype.hasOwnProperty.call(nextPayload, "mentorNotes")) {
    nextPayload.mentorNotes = sanitizeRichText(nextPayload.mentorNotes || "");
  }

  return nextPayload;
}

function sanitizeDiscussionPayload(payload) {
  const nextPayload = { ...payload };

  if (Object.prototype.hasOwnProperty.call(nextPayload, "title")) {
    nextPayload.title = sanitizePlainText(nextPayload.title);
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, "body")) {
    nextPayload.body = sanitizeRichText(nextPayload.body || "");
  }

  return nextPayload;
}

export const listModules = asyncHandler(async (req, res) => {
  const filter = {};
  applySharedFilters(req, filter);
  res.json(
    await listCollection({
      model: Module,
      req,
      filter,
      populate: [
        { path: "cohort", select: "title status" },
        { path: "assignedMentor", select: "name email role status cohort" }
      ],
      sort: { cohort: 1, startDate: 1, order: 1, createdAt: -1 }
    })
  );
});

export const createModule = asyncHandler(async (req, res) => {
  validateModuleDates(req.body);
  await validateModuleMentor(req.body);

  const module = await Module.create(sanitizeModulePayload(req.body));
  await module.populate("cohort", "title status");
  await module.populate("assignedMentor", "name email role status cohort");
  res.status(201).json({ data: module });
});

export const updateModule = asyncHandler(async (req, res) => {
  const module = await Module.findById(req.params.id);
  if (!module) throw new ApiError(404, "Module not found");

  const nextCohort = req.body.cohort || module.cohort;
  const nextAssignedMentor = Object.prototype.hasOwnProperty.call(req.body, "assignedMentor")
    ? req.body.assignedMentor
    : module.assignedMentor;
  const nextDates = {
    startDate: Object.prototype.hasOwnProperty.call(req.body, "startDate") ? req.body.startDate : module.startDate,
    endDate: Object.prototype.hasOwnProperty.call(req.body, "endDate") ? req.body.endDate : module.endDate
  };

  validateModuleDates(nextDates);
  await validateModuleMentor({ assignedMentor: nextAssignedMentor, cohort: nextCohort });

  Object.assign(module, sanitizeModulePayload(req.body));

  if (Object.prototype.hasOwnProperty.call(req.body, "assignedMentor") && !req.body.assignedMentor) {
    module.assignedMentor = undefined;
  }

  await module.save();
  await module.populate("cohort", "title status");
  await module.populate("assignedMentor", "name email role status cohort");

  res.json({ data: module });
});

export const deleteModule = asyncHandler(async (req, res) => {
  const module = await Module.findById(req.params.id);

  if (!module) throw new ApiError(404, "Module not found");

  const [sessionCount, resourceCount, discussionCount] = await Promise.all([
    Session.countDocuments({ module: module._id }),
    Resource.countDocuments({ module: module._id }),
    Discussion.countDocuments({ module: module._id })
  ]);

  if (sessionCount + resourceCount + discussionCount > 0) {
    throw new ApiError(409, "This module has linked records. Archive it instead of deleting it.");
  }

  await module.deleteOne();

  res.json({ data: { id: req.params.id, deleted: true } });
});

export const listSessions = asyncHandler(async (req, res) => {
  const filter = {};
  applySharedFilters(req, filter);
  res.json(
    await listCollection({
      model: Session,
      req,
      filter,
      populate: sessionPopulate(),
      sort: { startsAt: 1 }
    })
  );
});

export const createSession = asyncHandler(async (req, res) => {
  await validateSessionModule(req.body);
  const session = await Session.create(sanitizeSessionPayload(req.body));
  await session.populate(sessionPopulate());
  res.status(201).json({ data: session });
});

export const generateModuleSessions = asyncHandler(async (req, res) => {
  const module = await Module.findById(req.params.id)
    .select("title description cohort assignedMentor startDate endDate")
    .populate("assignedMentor", "name email role status");

  if (!module) {
    throw new ApiError(404, "Module not found");
  }

  await validateSessionModule({ cohort: module.cohort, module: module._id });

  if (!module.startDate || !module.endDate) {
    throw new ApiError(400, "Set module start and end dates before generating sessions.");
  }

  const windows = weekendCatSessionWindows(module.startDate, module.endDate);

  if (!windows.length) {
    throw new ApiError(400, "No Saturday or Sunday falls inside this module date range.");
  }

  const existingSessions = await Session.find({
    module: module._id,
    startsAt: { $in: windows.map((window) => window.startsAt) }
  }).select("startsAt");
  const existingStartTimes = new Set(existingSessions.map((session) => session.startsAt.toISOString()));
  const sessionsToCreate = windows
    .filter((window) => !existingStartTimes.has(window.startsAt.toISOString()))
    .map((window, index) => ({
      title: `${module.title} session${windows.length > 1 ? ` ${index + 1}` : ""}`,
      description: sanitizeRichText(module.description || `Weekend session for ${module.title}.`),
      cohort: module.cohort,
      module: module._id,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      status: "scheduled"
    }));

  if (sessionsToCreate.length) {
    await Session.insertMany(sessionsToCreate);
  }

  const sessions = await Session.find({
    module: module._id,
    startsAt: { $in: windows.map((window) => window.startsAt) }
  })
    .populate(sessionPopulate())
    .sort({ startsAt: 1 });

  res.status(sessionsToCreate.length ? 201 : 200).json({
    data: sessions,
    meta: {
      created: sessionsToCreate.length,
      existing: existingSessions.length,
      total: sessions.length
    }
  });
});

export const updateSession = asyncHandler(async (req, res) => {
  const existingSession = await Session.findById(req.params.id);
  if (!existingSession) throw new ApiError(404, "Session not found");

  const nextPayload = {
    cohort: Object.prototype.hasOwnProperty.call(req.body, "cohort") ? req.body.cohort : existingSession.cohort,
    module: Object.prototype.hasOwnProperty.call(req.body, "module") ? req.body.module : existingSession.module,
    ...req.body
  };
  await validateSessionModule(nextPayload);

  const session = await Session.findByIdAndUpdate(req.params.id, sanitizeSessionPayload(req.body), {
    new: true,
    runValidators: true
  }).populate(sessionPopulate());

  res.json({ data: session });
});

export const deleteSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id);

  if (!session) throw new ApiError(404, "Session not found");

  const resourceCount = await Resource.countDocuments({ session: session._id });

  if (resourceCount > 0 || session.attendance?.length) {
    throw new ApiError(409, "This session has linked resources or attendance. Cancel it instead of deleting it.");
  }

  await session.deleteOne();

  res.json({ data: { id: req.params.id, deleted: true } });
});

export const listResources = asyncHandler(async (req, res) => {
  const filter = {};
  applySharedFilters(req, filter);
  if (req.query.status) filter.visibility = req.query.status;
  res.json(
    await listCollection({
      model: Resource,
      req,
      filter,
      populate: [
        { path: "cohort", select: "title status" },
        { path: "module", select: "title status assignedMentor startDate endDate" },
        { path: "session", select: "title startsAt" },
        { path: "uploadedBy", select: "name email" }
      ]
    })
  );
});

export const createResource = asyncHandler(async (req, res) => {
  const resource = await Resource.create({
    ...sanitizeResourcePayload(req.body),
    uploadedBy: req.user._id
  });
  await resource.populate("cohort", "title status");
  await resource.populate("module", "title status assignedMentor startDate endDate");
  await resource.populate("session", "title startsAt");
  await resource.populate("uploadedBy", "name email");
  res.status(201).json({ data: resource });
});

export const updateResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findByIdAndUpdate(req.params.id, sanitizeResourcePayload(req.body), {
    new: true,
    runValidators: true
  })
    .populate("cohort", "title status")
    .populate("module", "title status assignedMentor startDate endDate")
    .populate("session", "title startsAt")
    .populate("uploadedBy", "name email");

  if (!resource) throw new ApiError(404, "Resource not found");
  res.json({ data: resource });
});

export const deleteResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) throw new ApiError(404, "Resource not found");

  await resource.deleteOne();

  res.json({ data: { id: req.params.id, deleted: true } });
});

export const listDiscussions = asyncHandler(async (req, res) => {
  const filter = {};
  applySharedFilters(req, filter);
  if (req.query.audience) filter.audience = req.query.audience;
  res.json(
    await listCollection({
      model: Discussion,
      req,
      filter,
      populate: [
        { path: "cohort", select: "title status" },
        { path: "module", select: "title status assignedMentor startDate endDate" },
        { path: "createdBy", select: "name email role profileImage bio expertise" },
        { path: "comments.createdBy", select: "name email role profileImage bio expertise" }
      ]
    })
  );
});

export const createDiscussion = asyncHandler(async (req, res) => {
  const discussion = await Discussion.create({
    ...sanitizeDiscussionPayload(req.body),
    createdBy: req.user._id
  });
  await discussion.populate("cohort", "title status");
  await discussion.populate("module", "title status assignedMentor startDate endDate");
  await discussion.populate("createdBy", "name email role profileImage bio expertise");
  await discussion.populate("comments.createdBy", "name email role profileImage bio expertise");
  res.status(201).json({ data: discussion });
});

export const updateDiscussion = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findByIdAndUpdate(req.params.id, sanitizeDiscussionPayload(req.body), {
    new: true,
    runValidators: true
  })
    .populate("cohort", "title status")
    .populate("module", "title status assignedMentor startDate endDate")
    .populate("createdBy", "name email role profileImage bio expertise")
    .populate("comments.createdBy", "name email role profileImage bio expertise");

  if (!discussion) throw new ApiError(404, "Discussion not found");
  res.json({ data: discussion });
});

export const deleteDiscussion = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findById(req.params.id);

  if (!discussion) throw new ApiError(404, "Discussion not found");

  if (discussion.comments?.length) {
    throw new ApiError(409, "This discussion has comments. Archive it instead of deleting it.");
  }

  await discussion.deleteOne();

  res.json({ data: { id: req.params.id, deleted: true } });
});

export const listBookings = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.mentor) filter.mentor = req.query.mentor;
  if (req.query.student) filter.student = req.query.student;
  if (req.query.status) filter.status = req.query.status;
  res.json(
    await listCollection({
      model: Booking,
      req,
      filter,
      populate: [
        { path: "student", select: "name email cohort" },
        { path: "mentor", select: "name email cohort" }
      ],
      sort: { startsAt: 1 }
    })
  );
});

export const updateBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findByIdAndUpdate(req.params.id, sanitizeBookingPayload(req.body), {
    new: true,
    runValidators: true
  })
    .populate("student", "name email cohort")
    .populate("mentor", "name email cohort");

  if (!booking) throw new ApiError(404, "Booking not found");
  res.json({ data: booking });
});

export const listReports = asyncHandler(async (req, res) => {
  const filter = { archivedAt: { $exists: false } };
  if (req.query.cohort) filter.cohort = req.query.cohort;
  if (req.query.mentor) filter.mentor = req.query.mentor;
  if (req.query.period) filter.period = req.query.period;
  if (req.query.reviewStatus) filter.reviewStatus = req.query.reviewStatus;
  res.json(
    await listCollection({
      model: Report,
      req,
      filter,
      populate: [
        { path: "cohort", select: "title status" },
        { path: "mentor", select: "name email" },
        { path: "studentsDoingWell", select: "name email" },
        { path: "studentsAtRisk", select: "name email" },
        { path: "adminComments.admin", select: "name email role" },
        { path: "lastReviewedBy", select: "name email role" }
      ],
      sort: { submittedAt: -1 }
    })
  );
});

export const updateReportReview = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    throw new ApiError(404, "Report not found");
  }

  const nextStatus = req.body.reviewStatus || report.reviewStatus;
  const cleanComment = sanitizeRichText(req.body.comment || "");
  const statusChanged = req.body.reviewStatus && req.body.reviewStatus !== report.reviewStatus;

  if (req.body.reviewStatus) {
    report.reviewStatus = req.body.reviewStatus;
    report.lastReviewedBy = req.user._id;
    report.reviewedAt = new Date();
  }

  if (cleanComment || statusChanged) {
    report.adminComments.push({
      admin: req.user._id,
      message: cleanComment || `Status changed to ${nextStatus}.`,
      status: nextStatus,
      action:
        nextStatus === "clarificationRequested"
          ? "clarification"
          : statusChanged
            ? "statusChange"
            : "comment"
    });
  }

  await report.save();
  await report.populate("cohort", "title status");
  await report.populate("mentor", "name email");
  await report.populate("studentsDoingWell", "name email");
  await report.populate("studentsAtRisk", "name email");
  await report.populate("adminComments.admin", "name email role");
  await report.populate("lastReviewedBy", "name email role");

  if (cleanComment || statusChanged) {
    await notifyUser({
      recipient: report.mentor,
      portalRole: "mentor",
      notification: {
        title: nextStatus === "clarificationRequested" ? "Clarification requested on your report" : "Admin updated your report",
        message: cleanComment || `Your report status changed to ${nextStatus}.`,
        channel: "both",
        previewText: sanitizePlainText(cleanComment || `Report status: ${nextStatus}`).slice(0, 160),
        type: "system",
        ctaLabel: "Open reports",
        ctaUrl: "/reports",
        targetType: "report",
        targetRole: "mentor",
        targetLabel: "Mentor report",
        readStatus: false
      }
    });
  }

  res.json({ data: report });
});

export const listSupportTickets = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) {
    const matchingStudents = await User.find({
      role: "student",
      $or: [
        { name: searchRegex(req.query.search) },
        { email: searchRegex(req.query.search) },
        /^[0-9a-fA-F]{24}$/.test(req.query.search) ? { _id: req.query.search } : null
      ].filter(Boolean)
    })
      .select("_id")
      .limit(25);

    filter.$or = [
      { subject: searchRegex(req.query.search) },
      { message: searchRegex(req.query.search) },
      { student: { $in: matchingStudents.map((student) => student._id) } }
    ];
  }
  res.json(
    await listCollection({
      model: SupportTicket,
      req,
      filter,
      populate: [
        { path: "student", select: "name email phone cohort mentor status lastLogin createdAt", populate: [
          { path: "cohort", select: "title status" },
          { path: "mentor", select: "name email" }
        ] },
        { path: "assignedTo", select: "name email role" },
        { path: "replies.createdBy", select: "name email role" }
      ]
    })
  );
});

function supportChecklist(ticket, context) {
  const checks = [];

  if (ticket.category === "login") {
    checks.push("Confirm the student email matches the account shown below.");
    checks.push(context.student?.lastLogin ? "Student has logged in before. Ask what changed since the last successful login." : "No successful login is recorded. Consider password reset or invite resend.");
    checks.push("Check account status and cohort assignment before escalating.");
  }

  if (ticket.category === "assignment") {
    checks.push("Check the latest submission status and whether the assignment is still published.");
    checks.push("If the student uploaded a file, confirm the file link opens from the submission row.");
    checks.push("If feedback says needs revision, reply with the exact correction expected.");
  }

  if (ticket.category === "resourceAccess") {
    checks.push("Confirm the student cohort has published resources.");
    checks.push("Ask which material title or link failed, then compare with recent materials count.");
  }

  if (ticket.category === "mentor") {
    checks.push("Confirm the assigned mentor and recent booking requests.");
    checks.push("If no mentor is assigned, update the student record from the Students section.");
  }

  if (ticket.category === "technical") {
    checks.push("Ask for device, browser, screenshot, and exact page path.");
    checks.push("Check recent notifications and submissions to confirm whether the action reached the server.");
  }

  return checks.length ? checks : [
    "Read the student message and confirm the affected page or action.",
    "Check student account status, cohort, mentor, and recent activity below.",
    "Reply with the next step and keep the ticket open until the student confirms resolution."
  ];
}

export const getSupportTicket = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id)
    .populate({
      path: "student",
      select: "name email phone cohort mentor status lastLogin createdAt",
      populate: [
        { path: "cohort", select: "title status" },
        { path: "mentor", select: "name email" }
      ]
    })
    .populate("assignedTo", "name email role")
    .populate("replies.createdBy", "name email role");

  if (!ticket) throw new ApiError(404, "Support ticket not found");

  const student = ticket.student;

  if (!student) {
    res.json({ data: { ticket, context: null, checklist: supportChecklist(ticket, {}) } });
    return;
  }

  const [
    totalAssignments,
    submittedCount,
    submissions,
    bookings,
    openTickets,
    materialsCount,
    notifications,
    systemLogs
  ] = await Promise.all([
    student.cohort ? Assignment.countDocuments({ cohort: student.cohort._id || student.cohort, status: { $in: ["published", "closed"] } }) : 0,
    Submission.countDocuments({ student: student._id, status: { $in: ["submitted", "lateSubmission", "reviewed", "needsRevision", "approved"] } }),
    Submission.find({ student: student._id })
      .populate("assignment", "title dueDate status maxScore")
      .sort({ submittedAt: -1 })
      .limit(8),
    Booking.find({ student: student._id })
      .populate("mentor", "name email")
      .sort({ startsAt: -1 })
      .limit(6),
    SupportTicket.countDocuments({ student: student._id, status: { $in: ["open", "inProgress"] } }),
    student.cohort ? Resource.countDocuments({ cohort: student.cohort._id || student.cohort, visibility: "published" }) : 0,
    Notification.find({ recipient: student._id, archivedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(6),
    SystemLog.find({
      $or: [
        { route: searchRegex(String(student._id)) },
        { "metadata.body.email": student.email },
        { "metadata.query.search": student.email }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(5)
  ]);

  const context = {
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      status: student.status,
      cohort: student.cohort,
      mentor: student.mentor,
      lastLogin: student.lastLogin,
      joinedAt: student.createdAt
    },
    summary: {
      totalAssignments,
      submittedCount,
      pendingAssignments: Math.max(totalAssignments - submittedCount, 0),
      openTickets,
      publishedMaterials: materialsCount
    },
    recentSubmissions: submissions,
    recentBookings: bookings,
    recentNotifications: notifications,
    recentSystemLogs: systemLogs
  };

  res.json({
    data: {
      ticket,
      context,
      checklist: supportChecklist(ticket, context)
    }
  });
});

export const updateSupportTicket = asyncHandler(async (req, res) => {
  const { reply, ...updates } = req.body;
  const update = { ...updates };

  if (reply) {
    const sanitizedReply = sanitizeRichText(reply);
    if (!update.status) update.status = "inProgress";
    if (!update.assignedTo) update.assignedTo = req.user._id;
    update.$push = {
      replies: {
        message: sanitizedReply,
        createdBy: req.user._id
      }
    };
  }

  const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true
  })
    .populate("student", "name email cohort")
    .populate("assignedTo", "name email role")
    .populate("replies.createdBy", "name email role");

  if (!ticket) throw new ApiError(404, "Support ticket not found");

  if (ticket.student && (reply || updates.status)) {
    const statusMessage = updates.status ? `Status changed to ${updates.status}.` : "";
    const notificationMessage = reply ? sanitizeRichText(reply) : statusMessage;
    await notifyUser({
      recipient: ticket.student,
      portalRole: "student",
      notification: {
        title: `Support update: ${ticket.subject}`,
        message: notificationMessage,
        channel: "both",
        previewText: sanitizePlainText(notificationMessage).slice(0, 160),
        type: "support",
        ctaLabel: "Open support",
        ctaUrl: "/app/support",
        targetType: "support",
        targetRole: "student",
        targetLabel: ticket.subject,
        readStatus: false
      }
    });
  }

  res.json({ data: ticket });
});

export const listNotifications = asyncHandler(async (req, res) => {
  const filter = { archivedAt: { $exists: false } };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.recipient) filter.recipient = req.query.recipient;
  if (req.query.search) {
    filter.$or = [
      { title: searchRegex(req.query.search) },
      { message: searchRegex(req.query.search) }
    ];
  }
  res.json(
    await listCollection({
      model: Notification,
      req,
      filter,
      populate: [{ path: "recipient", select: "name email role cohort" }]
    })
  );
});

export const listAnnouncements = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const match = {
    announcementId: { $exists: true, $ne: null }
  };

  if (req.user.role === "adminManager") {
    match.type = { $ne: "system" };
    match.$or = [
      { targetType: "cohort" },
      { targetRole: { $in: ADMIN_MANAGER_ANNOUNCEMENT_ROLES } }
    ];
  }

  if (req.query.search) {
    const searchFilter = [
      { title: searchRegex(req.query.search) },
      { message: searchRegex(req.query.search) },
      { targetLabel: searchRegex(req.query.search) }
    ];

    if (match.$or) {
      match.$and = [{ $or: match.$or }, { $or: searchFilter }];
      delete match.$or;
    } else {
      match.$or = searchFilter;
    }
  }

  if (req.query.channel) match.channel = req.query.channel;
  if (req.query.type) {
    if (req.user.role === "adminManager" && req.query.type === "system") {
      throw new ApiError(403, "Admin managers cannot view system announcements");
    }

    match.type = req.query.type;
  }

  const groupStage = {
    _id: "$announcementId",
    title: { $first: { $ifNull: ["$templateTitle", "$title"] } },
    message: { $first: { $ifNull: ["$templateMessage", "$message"] } },
    type: { $first: "$type" },
    channel: { $first: "$channel" },
    previewText: { $first: { $ifNull: ["$templatePreviewText", "$previewText"] } },
    ctaLabel: { $first: "$ctaLabel" },
    ctaUrl: { $first: "$ctaUrl" },
    targetType: { $first: "$targetType" },
    targetRole: { $first: "$targetRole" },
    targetLabel: { $first: "$targetLabel" },
    emailDeliveryStatuses: { $addToSet: "$emailDeliveryStatus" },
    emailSentCount: { $sum: { $cond: [{ $eq: ["$emailDeliveryStatus", "sent"] }, 1, 0] } },
    emailFailedCount: { $sum: { $cond: [{ $eq: ["$emailDeliveryStatus", "failed"] }, 1, 0] } },
    emailNotConfiguredCount: { $sum: { $cond: [{ $eq: ["$emailDeliveryStatus", "notConfigured"] }, 1, 0] } },
    emailDeliveryError: { $first: "$emailDeliveryError" },
    recipientCount: { $sum: 1 },
    readCount: { $sum: { $cond: ["$readStatus", 1, 0] } },
    sentAt: { $min: "$createdAt" }
  };

  const [rows, countRows] = await Promise.all([
    Notification.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $group: groupStage },
      { $sort: { sentAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]),
    Notification.aggregate([{ $match: match }, { $group: groupStage }, { $count: "total" }])
  ]);

  res.json(paginatedResponse({ data: rows, total: countRows[0]?.total || 0, page, limit }));
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const result = await Notification.deleteMany({ announcementId: req.params.id });

  if (!result.deletedCount) {
    throw new ApiError(404, "Announcement not found");
  }

  res.json({
    data: {
      id: req.params.id,
      deleted: true,
      deletedCount: result.deletedCount
    }
  });
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  const { targetType, cohort, role, recipient, type, channel, ctaUrl } =
    req.body;
  const title = sanitizePlainText(req.body.title);
  const message = sanitizeRichText(req.body.message);
  const previewText = sanitizePlainText(req.body.previewText || "");
  const ctaLabel = sanitizePlainText(req.body.ctaLabel || "");
  const filter = { status: "active" };

  if ((ctaLabel && !ctaUrl) || (ctaUrl && !ctaLabel)) {
    throw new ApiError(400, "CTA label and CTA URL must be provided together");
  }

  if (req.user.role === "adminManager") {
    if (type === "system") {
      throw new ApiError(403, "Admin managers cannot send system announcements");
    }

    if (targetType === "all") {
      throw new ApiError(403, "Admin managers must target a cohort, students, mentors, or one learner/mentor");
    }

    if (targetType === "role" && !ADMIN_MANAGER_ANNOUNCEMENT_ROLES.includes(role)) {
      throw new ApiError(403, "Admin managers can only target student and mentor roles");
    }
  }

  if (targetType === "cohort") {
    if (!cohort) throw new ApiError(400, "Cohort is required for cohort announcements");
    filter.cohort = cohort;
  }

  if (targetType === "role") {
    if (!role) throw new ApiError(400, "Role is required for role announcements");
    filter.role = role;
  }

  if (targetType === "user") {
    if (!recipient) throw new ApiError(400, "Recipient is required for user announcements");
    if (req.user.role === "adminManager") {
      const targetUser = await User.findById(recipient).select("role");

      if (!targetUser || !ADMIN_MANAGER_ANNOUNCEMENT_ROLES.includes(targetUser.role)) {
        throw new ApiError(403, "Admin managers can only send announcements to students and mentors");
      }
    }
    filter._id = recipient;
  }

  const recipients = await User.find(filter).select("_id email name role");

  if (!recipients.length) {
    throw new ApiError(404, "No recipients matched this announcement target");
  }

  const announcementId = crypto.randomUUID();
  const targetLabel = await resolveAnnouncementTargetLabel({ targetType, cohort, role, recipient });
  const targetRole = targetType === "role" ? role : targetType === "user" ? recipients[0]?.role : undefined;

  const notifications = await Notification.insertMany(
    recipients.map((user) => {
      const personalized = personalizeAnnouncementForRecipient(
        { title, message, previewText, ctaLabel },
        user
      );

      return {
        recipient: user._id,
        announcementId,
        title: personalized.title,
        message: personalized.message,
        templateTitle: title,
        templateMessage: message,
        templatePreviewText: previewText,
        channel,
        previewText: personalized.previewText,
        ctaLabel: personalized.ctaLabel,
        ctaUrl,
        targetType,
        targetRole,
        targetLabel,
        emailDeliveryStatus: ["email", "both"].includes(channel) ? "pending" : "notRequested",
        type,
        readStatus: false
      };
    })
  );

  const delivery = await sendAnnouncementEmails({
    recipients,
    announcement: {
      title,
      message,
      channel,
      previewText,
      ctaLabel,
      ctaUrl,
      type,
      targetLabel
    }
  });

  if (delivery.status !== "notRequested") {
    const deliveryUpdate = {
      emailDeliveryStatus: delivery.status,
      emailDeliveryError: delivery.error || ""
    };

    if (delivery.status === "sent") {
      deliveryUpdate.emailSentAt = new Date();
    }

    await Notification.updateMany(
      { announcementId },
      {
        $set: deliveryUpdate
      }
    );
  }

  res.status(201).json({
    data: {
      created: notifications.length,
      announcementId,
      emailDeliveryStatus: delivery.status,
      emailSent: delivery.sent,
      emailFailed: delivery.failed,
      title,
      targetType,
      targetLabel
    }
  });
});

export const listSystemLogs = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.action) filter.action = searchRegex(req.query.action);
  if (req.query.statusCode) filter.statusCode = req.query.statusCode;
  res.json(
    await listCollection({
      model: SystemLog,
      req,
      filter,
      populate: [{ path: "user", select: "name email role" }]
    })
  );
});
