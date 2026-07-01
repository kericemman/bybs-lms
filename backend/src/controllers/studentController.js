import { Assignment } from "../models/Assignment.js";
import { Booking } from "../models/Booking.js";
import { MentorAvailability } from "../models/MentorAvailability.js";
import { Module } from "../models/Module.js";
import { Notification } from "../models/Notification.js";
import { Resource } from "../models/Resource.js";
import { Session } from "../models/Session.js";
import { Submission } from "../models/Submission.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { sanitizePlainText, sanitizeRichText } from "../utils/sanitizeRichText.js";

const activeAssignmentStatuses = ["published", "closed"];
const submittedStatuses = ["submitted", "lateSubmission", "reviewed", "needsRevision", "approved"];

function requireStudentCohort(student) {
  if (!student.cohort) {
    throw new ApiError(400, "You are not assigned to a cohort yet");
  }

  return student.cohort;
}

function assignmentFilter(student, extra = {}) {
  return {
    cohort: requireStudentCohort(student),
    status: { $in: activeAssignmentStatuses },
    ...extra
  };
}

async function assignmentRows(student, filter, { skip = 0, limit = 100 } = {}) {
  const [assignments, total, submissions] = await Promise.all([
    Assignment.find(filter)
      .populate("cohort", "title status")
      .populate("module", "title startDate endDate")
      .populate("createdBy", "name email role")
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(limit),
    Assignment.countDocuments(filter),
    Submission.find({ student: student._id }).populate("reviewedBy", "name email")
  ]);

  const submissionsByAssignment = new Map(
    submissions.map((submission) => [String(submission.assignment), submission])
  );

  return {
    total,
    data: assignments.map((assignment) => ({
      ...assignment.toObject(),
      submission: submissionsByAssignment.get(String(assignment._id)) || null
    }))
  };
}

function progressPercentage({ totalAssignments, submittedCount }) {
  if (!totalAssignments) return 0;
  return Math.round((submittedCount / totalAssignments) * 100);
}

export const studentDashboard = asyncHandler(async (req, res) => {
  const cohortId = requireStudentCohort(req.user);
  const now = new Date();

  const [
    totalAssignments,
    submittedCount,
    pendingAssignments,
    upcomingSessions,
    unreadNotifications,
    recentNotifications,
    nextSessions,
    latestAssignments
  ] = await Promise.all([
    Assignment.countDocuments(assignmentFilter(req.user)),
    Submission.countDocuments({ student: req.user._id, status: { $in: submittedStatuses } }),
    Assignment.countDocuments(assignmentFilter(req.user, { dueDate: { $gte: now } })),
    Session.countDocuments({ cohort: cohortId, status: "scheduled", startsAt: { $gte: now } }),
    Notification.countDocuments({ recipient: req.user._id, readStatus: false }),
    Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5),
    Session.find({ cohort: cohortId, status: "scheduled", startsAt: { $gte: now } })
      .populate("module", "title")
      .sort({ startsAt: 1 })
      .limit(4),
    Assignment.find(assignmentFilter(req.user))
      .populate("module", "title")
      .sort({ dueDate: 1 })
      .limit(4)
  ]);

  res.json({
    data: {
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        cohort: req.user.cohort,
        mentor: req.user.mentor
      },
      summary: {
        totalAssignments,
        submittedCount,
        pendingAssignments: Math.max(totalAssignments - submittedCount, 0),
        upcomingSessions,
        unreadNotifications,
        progress: progressPercentage({ totalAssignments, submittedCount })
      },
      nextSessions,
      latestAssignments,
      notifications: recentNotifications
    }
  });
});

export const listStudentModules = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const cohortId = requireStudentCohort(req.user);
  const filter = { cohort: cohortId, status: "published" };

  const [modules, total] = await Promise.all([
    Module.find(filter)
      .populate("assignedMentor", "name email")
      .sort({ startDate: 1, order: 1 })
      .skip(skip)
      .limit(limit),
    Module.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: modules, total, page, limit }));
});

export const listStudentSessions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const cohortId = requireStudentCohort(req.user);

  const [sessions, total] = await Promise.all([
    Session.find({ cohort: cohortId, status: { $ne: "cancelled" } })
      .populate("module", "title")
      .sort({ startsAt: 1 })
      .skip(skip)
      .limit(limit),
    Session.countDocuments({ cohort: cohortId, status: { $ne: "cancelled" } })
  ]);

  res.json(paginatedResponse({ data: sessions, total, page, limit }));
});

export const listStudentMaterials = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const cohortId = requireStudentCohort(req.user);

  const [resources, total] = await Promise.all([
    Resource.find({ cohort: cohortId, visibility: "published" })
      .populate("module", "title")
      .populate("session", "title startsAt")
      .populate("uploadedBy", "name role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Resource.countDocuments({ cohort: cohortId, visibility: "published" })
  ]);

  res.json(paginatedResponse({ data: resources, total, page, limit }));
});

export const listStudentAssignments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = assignmentFilter(req.user);

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const { data, total } = await assignmentRows(req.user, filter, { skip, limit });
  const filteredData = req.query.submissionStatus
    ? data.filter((assignment) => (assignment.submission?.status || "notStarted") === req.query.submissionStatus)
    : data;

  res.json(paginatedResponse({ data: filteredData, total, page, limit }));
});

export const submitStudentAssignment = asyncHandler(async (req, res) => {
  if (!req.body.fileUrl && !req.body.writtenResponse) {
    throw new ApiError(400, "Add a file or written response before submitting");
  }

  const assignment = await Assignment.findOne({
    ...assignmentFilter(req.user),
    _id: req.params.id
  });

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  if (assignment.status !== "published") {
    throw new ApiError(409, "This assignment is not accepting submissions");
  }

  const existingSubmission = await Submission.findOne({
    assignment: assignment._id,
    student: req.user._id
  });

  if (existingSubmission && !assignment.allowResubmission) {
    throw new ApiError(409, "This assignment does not allow resubmission");
  }

  if (assignment.status === "closed" && !assignment.allowResubmission) {
    throw new ApiError(409, "This assignment is closed");
  }

  const isLate = new Date() > new Date(assignment.dueDate);
  const payload = {
    fileUrl: req.body.fileUrl,
    writtenResponse: sanitizeRichText(req.body.writtenResponse || ""),
    submittedAt: new Date(),
    isLate,
    status: isLate ? "lateSubmission" : "submitted",
    reviewedBy: undefined,
    reviewedAt: undefined,
    feedback: undefined,
    score: undefined
  };

  const submission = existingSubmission || new Submission({
    assignment: assignment._id,
    student: req.user._id
  });

  Object.assign(submission, payload);
  await submission.save();
  await submission.populate("assignment", "title dueDate maxScore status");
  await submission.populate("reviewedBy", "name email");

  if (req.user.mentor) {
    await Notification.create({
      recipient: req.user.mentor,
      title: `Submission ready: ${assignment.title}`,
      message: `${req.user.name} submitted an assignment for review.`,
      channel: "platform",
      previewText: req.body.writtenResponse?.slice(0, 160) || "A file submission was uploaded.",
      type: "assignment",
      ctaLabel: "Review submission",
      ctaUrl: "/reviews",
      readStatus: false
    });
  }

  res.status(existingSubmission ? 200 : 201).json({ data: submission });
});

export const studentProgress = asyncHandler(async (req, res) => {
  const cohortId = requireStudentCohort(req.user);
  const [totalAssignments, submissions, sessions] = await Promise.all([
    Assignment.countDocuments(assignmentFilter(req.user)),
    Submission.find({ student: req.user._id }),
    Session.find({ cohort: cohortId, status: { $ne: "cancelled" } }).select("attendance status startsAt")
  ]);

  const submittedCount = submissions.filter((submission) => submittedStatuses.includes(submission.status)).length;
  const reviewedCount = submissions.filter((submission) => ["reviewed", "approved"].includes(submission.status)).length;
  const needsRevisionCount = submissions.filter((submission) => submission.status === "needsRevision").length;
  const scores = submissions.filter((submission) => typeof submission.score === "number");
  const averageScore = scores.length
    ? Math.round(scores.reduce((total, submission) => total + submission.score, 0) / scores.length)
    : null;
  const attendanceMarked = sessions.filter((session) =>
    session.attendance?.some((item) => String(item.student) === String(req.user._id))
  );
  const attended = attendanceMarked.filter((session) =>
    session.attendance?.some((item) =>
      String(item.student) === String(req.user._id) && ["present", "late", "excused"].includes(item.status)
    )
  );
  const attendancePercentage = attendanceMarked.length ? Math.round((attended.length / attendanceMarked.length) * 100) : 0;

  res.json({
    data: {
      totalAssignments,
      submittedCount,
      reviewedCount,
      needsRevisionCount,
      averageScore,
      progress: progressPercentage({ totalAssignments, submittedCount }),
      attendancePercentage,
      attendanceMarked: attendanceMarked.length,
      attended: attended.length
    }
  });
});

export const listStudentMentorAvailability = asyncHandler(async (req, res) => {
  if (!req.user.mentor) {
    res.json({ data: [] });
    return;
  }

  const slots = await MentorAvailability.find({ mentor: req.user.mentor, isActive: true }).sort({ dayOfWeek: 1, startTime: 1 });
  res.json({ data: slots });
});

export const listStudentBookings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [bookings, total] = await Promise.all([
    Booking.find({ student: req.user._id })
      .populate("mentor", "name email")
      .sort({ startsAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments({ student: req.user._id })
  ]);

  res.json(paginatedResponse({ data: bookings, total, page, limit }));
});

export const createStudentBooking = asyncHandler(async (req, res) => {
  if (!req.user.mentor) {
    throw new ApiError(400, "You do not have an assigned mentor yet");
  }

  const startsAt = new Date(req.body.startsAt);
  if (startsAt < new Date()) {
    throw new ApiError(400, "Choose a future time for your booking");
  }

  const booking = await Booking.create({
    student: req.user._id,
    mentor: req.user.mentor,
    startsAt,
    endsAt: req.body.endsAt,
    reason: sanitizeRichText(req.body.reason),
    status: "pending"
  });

  await Notification.create({
    recipient: req.user.mentor,
    title: "New student booking request",
    message: `${req.user.name} requested a mentor session.`,
    channel: "platform",
    previewText: sanitizePlainText(req.body.reason).slice(0, 160),
    type: "booking",
    ctaLabel: "Review booking",
    ctaUrl: "/bookings",
    readStatus: false
  });

  await booking.populate("mentor", "name email");
  res.status(201).json({ data: booking });
});

export const updateStudentBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, student: req.user._id });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (!["pending", "approved"].includes(booking.status)) {
    throw new ApiError(409, "This booking can no longer be cancelled");
  }

  booking.status = req.body.status;
  await booking.save();
  await booking.populate("mentor", "name email");
  res.json({ data: booking });
});

export const listStudentSupportTickets = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [tickets, total] = await Promise.all([
    SupportTicket.find({ student: req.user._id })
      .populate("assignedTo", "name email")
      .populate("replies.createdBy", "name role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    SupportTicket.countDocuments({ student: req.user._id })
  ]);

  res.json(paginatedResponse({ data: tickets, total, page, limit }));
});

export const createStudentSupportTicket = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.create({
    ...req.body,
    subject: sanitizePlainText(req.body.subject),
    message: sanitizeRichText(req.body.message),
    student: req.user._id
  });

  await ticket.populate("assignedTo", "name email");
  res.status(201).json({ data: ticket });
});

export const replyStudentSupportTicket = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findOne({ _id: req.params.id, student: req.user._id });

  if (!ticket) {
    throw new ApiError(404, "Support ticket not found");
  }

  ticket.replies.push({
    message: sanitizeRichText(req.body.message),
    createdBy: req.user._id
  });
  ticket.status = ticket.status === "closed" ? "open" : ticket.status;
  await ticket.save();
  await ticket.populate("assignedTo", "name email");
  await ticket.populate("replies.createdBy", "name role");
  res.json({ data: ticket });
});

export const listStudentNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [notifications, total] = await Promise.all([
    Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments({ recipient: req.user._id })
  ]);

  res.json(paginatedResponse({ data: notifications, total, page, limit }));
});

export const markStudentNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { readStatus: true },
    { new: true }
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  res.json({ data: notification });
});
