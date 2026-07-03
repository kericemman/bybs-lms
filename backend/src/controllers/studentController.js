import { Assignment } from "../models/Assignment.js";
import { Booking } from "../models/Booking.js";
import { Discussion } from "../models/Discussion.js";
import { MentorAvailability } from "../models/MentorAvailability.js";
import { Module } from "../models/Module.js";
import { Notification } from "../models/Notification.js";
import { Resource } from "../models/Resource.js";
import { Session } from "../models/Session.js";
import { Submission } from "../models/Submission.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { User } from "../models/User.js";
import { notifyUser, notifyUsers } from "../services/portalNotificationService.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { sanitizePlainText, sanitizeRichText } from "../utils/sanitizeRichText.js";

const activeAssignmentStatuses = ["published", "closed"];
const submittedStatuses = ["submitted", "lateSubmission", "reviewed", "needsRevision", "approved"];
const dayIndexes = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};
const daysByIndex = Object.fromEntries(Object.entries(dayIndexes).map(([day, index]) => [index, day]));

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

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function discussionSearchFilter(search = "") {
  const cleanSearch = sanitizePlainText(search).trim();
  if (!cleanSearch) return {};

  const pattern = { $regex: escapeRegExp(cleanSearch), $options: "i" };
  return { $or: [{ title: pattern }, { body: pattern }] };
}

function populateDiscussion(query) {
  return query
    .populate("cohort", "title status")
    .populate("module", "title status startDate endDate")
    .populate("createdBy", "name email role profileImage")
    .populate("comments.createdBy", "name email role profileImage");
}

async function populateDiscussionDocument(discussion) {
  await discussion.populate("cohort", "title status");
  await discussion.populate("module", "title status startDate endDate");
  await discussion.populate("createdBy", "name email role profileImage");
  await discussion.populate("comments.createdBy", "name email role profileImage");
}

async function assertStudentDiscussionModule(student, moduleId) {
  if (!moduleId) return;

  const module = await Module.findOne({
    _id: moduleId,
    cohort: requireStudentCohort(student),
    status: { $ne: "archived" }
  }).select("_id");

  if (!module) {
    throw new ApiError(403, "This module is not available in your cohort");
  }
}

function timeParts(value = "") {
  const [hours = 0, minutes = 0] = String(value).split(":").map((part) => Number(part));
  return { hours, minutes };
}

function minutesFromTime(value = "") {
  const { hours, minutes } = timeParts(value);
  return hours * 60 + minutes;
}

function minutesFromDate(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function dayKey(date) {
  return daysByIndex[date.getDay()];
}

function dateWithTime(date, time) {
  const nextDate = new Date(date);
  const { hours, minutes } = timeParts(time);
  nextDate.setHours(hours, minutes, 0, 0);
  return nextDate;
}

function upcomingAvailabilityOptions(slots = [], { daysAhead = 28 } = {}) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);

  return slots
    .flatMap((slot) => {
      const options = [];

      for (let offset = 0; offset <= daysAhead; offset += 1) {
        const candidateDate = new Date(startDate);
        candidateDate.setDate(startDate.getDate() + offset);

        if (dayKey(candidateDate) !== slot.dayOfWeek) continue;

        const startsAt = dateWithTime(candidateDate, slot.startTime);
        const endsAt = dateWithTime(candidateDate, slot.endTime);

        if (startsAt <= now || endsAt <= startsAt) continue;

        options.push({
          availabilitySlot: slot._id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          startsAt,
          endsAt
        });
      }

      return options;
    })
    .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt))
    .slice(0, 24);
}

function bookingFitsSlot({ startsAt, endsAt, slot }) {
  const startMinutes = minutesFromDate(startsAt);
  const endMinutes = minutesFromDate(endsAt);
  const slotStartMinutes = minutesFromTime(slot.startTime);
  const slotEndMinutes = minutesFromTime(slot.endTime);

  return (
    dayKey(startsAt) === slot.dayOfWeek &&
    dayKey(endsAt) === slot.dayOfWeek &&
    startMinutes >= slotStartMinutes &&
    endMinutes <= slotEndMinutes &&
    endsAt > startsAt
  );
}

async function resolveBookingAvailability({ mentorId, startsAt, requestedEndsAt, availabilitySlotId }) {
  const slotFilter = { mentor: mentorId, isActive: true };
  if (availabilitySlotId) {
    slotFilter._id = availabilitySlotId;
  }

  const slots = await MentorAvailability.find(slotFilter).sort({ dayOfWeek: 1, startTime: 1 });

  if (!slots.length) {
    throw new ApiError(400, "Your mentor has not published availability for that time");
  }

  const matchingSlot = slots.find((slot) => {
    const defaultEndsAt = dateWithTime(startsAt, slot.endTime);
    const endsAt = requestedEndsAt || defaultEndsAt;
    return bookingFitsSlot({ startsAt, endsAt, slot });
  });

  if (!matchingSlot) {
    throw new ApiError(400, "Choose a time inside your mentor's published availability");
  }

  return {
    slot: matchingSlot,
    endsAt: requestedEndsAt || dateWithTime(startsAt, matchingSlot.endTime)
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
      .populate("createdBy", "name email role")
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

export const listStudentDiscussions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {
    status: req.query.status || { $ne: "archived" },
    ...discussionSearchFilter(req.query.search)
  };

  if (req.query.cohort) {
    filter.cohort = req.query.cohort;
  }

  if (req.query.module) {
    filter.module = req.query.module;
  }

  const [discussions, total] = await Promise.all([
    populateDiscussion(Discussion.find(filter))
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Discussion.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: discussions, total, page, limit }));
});

export const createStudentDiscussion = asyncHandler(async (req, res) => {
  await assertStudentDiscussionModule(req.user, req.body.module);

  const discussion = await Discussion.create({
    cohort: req.user.cohort,
    module: req.body.module,
    title: sanitizePlainText(req.body.title),
    body: sanitizeRichText(req.body.body || ""),
    createdBy: req.user._id,
    status: "open"
  });

  await populateDiscussionDocument(discussion);
  res.status(201).json({ data: discussion });
});

export const replyStudentDiscussion = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findOne({
    _id: req.params.id,
    status: "open"
  });

  if (!discussion) {
    throw new ApiError(404, "Open discussion not found");
  }

  const ownerId = discussion.createdBy;
  const cleanBody = sanitizeRichText(req.body.body);

  discussion.comments.push({
    body: cleanBody,
    createdBy: req.user._id
  });
  await discussion.save();

  if (String(ownerId) !== String(req.user._id)) {
    const owner = await User.findById(ownerId).select("name email role");

    if (owner) {
      const ownerPortalUrl = owner.role === "student" ? "/app/forum" : owner.role === "mentor" ? "/forum" : "/discussions";

      await notifyUser({
        recipient: owner,
        portalRole: owner.role,
        notification: {
          title: `New reply: ${discussion.title}`,
          message: `${req.user.name} replied to your discussion.`,
          channel: "both",
          previewText: sanitizePlainText(cleanBody).slice(0, 160),
          type: "system",
          ctaLabel: "Open forum",
          ctaUrl: ownerPortalUrl,
          targetType: "discussion",
          targetRole: owner.role,
          targetLabel: "Forum discussion",
          readStatus: false
        }
      });
    }
  }

  await populateDiscussionDocument(discussion);
  res.status(201).json({ data: discussion });
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
    const mentor = await User.findById(req.user.mentor).select("name email role");

    if (mentor) {
      await notifyUser({
        recipient: mentor,
        portalRole: "mentor",
        notification: {
          title: `Submission ready: ${assignment.title}`,
          message: `${req.user.name} submitted an assignment for review.`,
          channel: "both",
          previewText: sanitizePlainText(req.body.writtenResponse || "A file submission was uploaded.").slice(0, 160),
          type: "assignment",
          ctaLabel: "Review submission",
          ctaUrl: "/reviews",
          targetType: "assignment",
          targetRole: "mentor",
          targetLabel: assignment.title,
          readStatus: false
        }
      });
    }
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
    res.json({ data: [], upcoming: [] });
    return;
  }

  const slots = await MentorAvailability.find({ mentor: req.user.mentor, isActive: true }).sort({ dayOfWeek: 1, startTime: 1 });
  res.json({
    data: slots,
    upcoming: upcomingAvailabilityOptions(slots)
  });
});

export const listStudentBookings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [bookings, total] = await Promise.all([
    Booking.find({ student: req.user._id })
      .populate("mentor", "name email")
      .populate("availabilitySlot", "dayOfWeek startTime endTime isActive")
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
  const requestedEndsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
  if (startsAt < new Date()) {
    throw new ApiError(400, "Choose a future time for your booking");
  }

  const { slot, endsAt } = await resolveBookingAvailability({
    mentorId: req.user.mentor,
    startsAt,
    requestedEndsAt,
    availabilitySlotId: req.body.availabilitySlot
  });

  const existingBooking = await Booking.findOne({
    mentor: req.user.mentor,
    startsAt,
    status: { $in: ["pending", "approved"] }
  }).select("_id");

  if (existingBooking) {
    throw new ApiError(409, "That mentor availability slot already has a pending or approved booking");
  }

  const booking = await Booking.create({
    student: req.user._id,
    mentor: req.user.mentor,
    availabilitySlot: slot._id,
    startsAt,
    endsAt,
    reason: sanitizeRichText(req.body.reason),
    status: "pending"
  });

  const mentor = await User.findById(req.user.mentor).select("name email role");

  if (mentor) {
    await notifyUser({
      recipient: mentor,
      portalRole: "mentor",
      notification: {
        title: "New mentee booking request",
        message: `${req.user.name} requested a mentor session.`,
        channel: "both",
        previewText: sanitizePlainText(req.body.reason).slice(0, 160),
        type: "booking",
        ctaLabel: "Review booking",
        ctaUrl: "/bookings",
        targetType: "booking",
        targetRole: "mentor",
        targetLabel: "Mentee booking request",
        readStatus: false
      }
    });
  }

  await booking.populate("mentor", "name email");
  await booking.populate("availabilitySlot", "dayOfWeek startTime endTime isActive");
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
  await booking.populate("availabilitySlot", "dayOfWeek startTime endTime isActive");

  if (booking.mentor) {
    await notifyUser({
      recipient: booking.mentor,
      portalRole: "mentor",
      notification: {
        title: "Booking cancelled",
        message: `${req.user.name} cancelled a mentor booking.`,
        channel: "both",
        previewText: `Cancelled booking for ${new Date(booking.startsAt).toLocaleString()}.`,
        type: "booking",
        ctaLabel: "Open bookings",
        ctaUrl: "/bookings",
        targetType: "booking",
        targetRole: "mentor",
        targetLabel: "Cancelled booking",
        readStatus: false
      }
    });
  }

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

  const admins = await User.find({
    role: { $in: ["admin", "adminManager", "superAdmin"] },
    status: { $ne: "removed" }
  }).select("name email role");

  if (admins.length) {
    await notifyUsers({
      recipients: admins,
      portalRole: "admin",
      notification: {
        title: `New support ticket: ${ticket.subject}`,
        message: `${req.user.name} opened a support ticket.`,
        channel: "both",
        previewText: sanitizePlainText(req.body.message).slice(0, 160),
        type: "support",
        ctaLabel: "Open support",
        ctaUrl: "/support",
        targetType: "support",
        targetRole: "admin",
        targetLabel: ticket.subject,
        readStatus: false
      }
    });
  }

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

  const recipients = ticket.assignedTo
    ? [ticket.assignedTo]
    : await User.find({
      role: { $in: ["admin", "adminManager", "superAdmin"] },
      status: { $ne: "removed" }
    }).select("name email role");

  if (recipients.length) {
    await notifyUsers({
      recipients,
      portalRole: "admin",
      notification: {
        title: `Support reply: ${ticket.subject}`,
        message: `${req.user.name} added a reply to a support ticket.`,
        channel: "both",
        previewText: sanitizePlainText(req.body.message).slice(0, 160),
        type: "support",
        ctaLabel: "Open support",
        ctaUrl: "/support",
        targetType: "support",
        targetRole: "admin",
        targetLabel: ticket.subject,
        readStatus: false
      }
    });
  }

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
