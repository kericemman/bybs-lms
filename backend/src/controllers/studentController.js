import { Assignment } from "../models/Assignment.js";
import { Booking } from "../models/Booking.js";
import { Cohort } from "../models/Cohort.js";
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
import { calculateStudentProgress } from "../services/progressService.js";
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
  return { $or: [{ title: pattern }, { body: pattern }, { "comments.body": pattern }] };
}

const studentDiscussionAudiences = ["all", "mentorsMentees"];

function discussionAudienceFilter(audiences) {
  return {
    $or: [
      { audience: { $exists: false } },
      { audience: { $in: audiences } }
    ]
  };
}

function attachAndFilters(filter, filters) {
  const activeFilters = filters.filter((item) => item && Object.keys(item).length);
  if (activeFilters.length) {
    filter.$and = activeFilters;
  }
  return filter;
}

function populateDiscussion(query) {
  return query
    .populate("cohort", "title status")
    .populate("module", "title status startDate endDate")
    .populate("createdBy", "name email role profileImage bio expertise")
    .populate("comments.createdBy", "name email role profileImage bio expertise")
    .populate("reactions.user", "name email role")
    .populate("comments.reactions.user", "name email role");
}

async function populateDiscussionDocument(discussion) {
  await discussion.populate("cohort", "title status");
  await discussion.populate("module", "title status startDate endDate");
  await discussion.populate("createdBy", "name email role profileImage bio expertise");
  await discussion.populate("comments.createdBy", "name email role profileImage bio expertise");
  await discussion.populate("reactions.user", "name email role");
  await discussion.populate("comments.reactions.user", "name email role");
}

function toggleReaction(reactions = [], userId, reaction) {
  const existingIndex = reactions.findIndex((item) => String(item.user?._id || item.user) === String(userId));

  if (existingIndex >= 0) {
    if (reactions[existingIndex].reaction === reaction) {
      reactions.splice(existingIndex, 1);
      return;
    }

    reactions[existingIndex].reaction = reaction;
    return;
  }

  reactions.push({ user: userId, reaction });
}

function removeCommentTree(discussion, commentId) {
  const idsToRemove = new Set([String(commentId)]);
  let changed = true;

  while (changed) {
    changed = false;
    discussion.comments.forEach((comment) => {
      const parentId = String(comment.parentComment || "");
      const commentStringId = String(comment._id);

      if (parentId && idsToRemove.has(parentId) && !idsToRemove.has(commentStringId)) {
        idsToRemove.add(commentStringId);
        changed = true;
      }
    });
  }

  idsToRemove.forEach((id) => discussion.comments.pull({ _id: id }));
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

function idString(value) {
  return String(value?._id || value || "");
}

function serializeMentor(mentor) {
  const source = typeof mentor?.toObject === "function" ? mentor.toObject() : mentor;
  if (!source) return null;

  return {
    _id: source._id,
    id: source.id || idString(source._id),
    name: source.name,
    email: source.email,
    profileImage: source.profileImage,
    bio: source.bio,
    expertise: source.expertise || []
  };
}

async function studentMentorIds(student) {
  const mentorIds = new Set();
  const directMentorId = idString(student.mentor);
  const cohortId = idString(student.cohort);

  if (directMentorId) {
    mentorIds.add(directMentorId);
  }

  if (cohortId) {
    const [cohort, cohortMentors, moduleMentorIds] = await Promise.all([
      Cohort.findById(cohortId).select("mentors"),
      User.find({ role: "mentor", status: { $ne: "removed" }, cohort: cohortId }).select("_id"),
      Module.distinct("assignedMentor", {
        cohort: cohortId,
        assignedMentor: { $exists: true, $ne: null },
        status: { $ne: "archived" }
      })
    ]);

    cohort?.mentors?.forEach((mentorId) => mentorIds.add(idString(mentorId)));
    cohortMentors.forEach((mentor) => mentorIds.add(idString(mentor._id)));
    moduleMentorIds.forEach((mentorId) => mentorIds.add(idString(mentorId)));
  }

  const ids = [...mentorIds].filter(Boolean);
  if (!ids.length) return [];

  const activeMentors = await User.find({
    _id: { $in: ids },
    role: "mentor",
    status: { $ne: "removed" }
  }).select("_id");

  return activeMentors.map((mentor) => idString(mentor._id));
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
          mentorId: idString(slot.mentor),
          mentor: serializeMentor(slot.mentor),
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

function searchPattern(search = "") {
  const cleanSearch = sanitizePlainText(search).trim();
  if (cleanSearch.length < 2) return null;
  return { $regex: escapeRegExp(cleanSearch), $options: "i" };
}

function textPreview(value = "", limit = 130) {
  const text = sanitizePlainText(value).replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3).trimEnd()}...`;
}

function searchResult({ id, type, title, description, href, createdAt }) {
  return {
    id,
    type,
    title,
    description,
    href,
    createdAt
  };
}

function progressPercentage({ totalAssignments, submittedCount }) {
  if (!totalAssignments) return 0;
  return Math.round((submittedCount / totalAssignments) * 100);
}

export const studentSearch = asyncHandler(async (req, res) => {
  const { limit } = getPagination(req.query);
  const cohortId = requireStudentCohort(req.user);
  const pattern = searchPattern(req.query.search);

  if (!pattern) {
    res.json({ data: [], meta: { total: 0, limit } });
    return;
  }

  const perTypeLimit = Math.max(4, Math.ceil(limit / 4));
  const [
    assignments,
    modules,
    sessions,
    resources,
    discussions,
    notifications
  ] = await Promise.all([
    Assignment.find({
      ...assignmentFilter(req.user),
      $or: [{ title: pattern }, { instructions: pattern }]
    })
      .populate("module", "title")
      .sort({ dueDate: 1 })
      .limit(perTypeLimit),
    Module.find({
      cohort: cohortId,
      status: "published",
      $or: [{ title: pattern }, { description: pattern }]
    })
      .sort({ startDate: 1, order: 1 })
      .limit(perTypeLimit),
    Session.find({
      cohort: cohortId,
      status: { $ne: "cancelled" },
      $or: [{ title: pattern }, { description: pattern }, { zoomLink: pattern }, { recordingLink: pattern }]
    })
      .populate("module", "title")
      .sort({ startsAt: 1 })
      .limit(perTypeLimit),
    Resource.find({
      cohort: cohortId,
      visibility: "published",
      $or: [{ title: pattern }, { description: pattern }, { type: pattern }, { fileType: pattern }]
    })
      .populate("module", "title")
      .sort({ createdAt: -1 })
      .limit(perTypeLimit),
    populateDiscussion(
      Discussion.find(
        attachAndFilters(
          { status: { $ne: "archived" } },
          [discussionAudienceFilter(studentDiscussionAudiences), discussionSearchFilter(req.query.search)]
        )
      )
    )
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(perTypeLimit),
    Notification.find({
      recipient: req.user._id,
      archivedAt: { $exists: false },
      $or: [{ title: pattern }, { message: pattern }, { previewText: pattern }, { targetLabel: pattern }]
    })
      .sort({ createdAt: -1 })
      .limit(perTypeLimit)
  ]);

  const results = [
    ...assignments.map((assignment) =>
      searchResult({
        id: assignment.id,
        type: "Assignment",
        title: assignment.title,
        description: `${assignment.module?.title || "General assignment"}${assignment.dueDate ? ` · Due ${assignment.dueDate.toISOString().slice(0, 10)}` : ""}`,
        href: "/app/assignments",
        createdAt: assignment.createdAt
      })
    ),
    ...modules.map((module) =>
      searchResult({
        id: module.id,
        type: "Module",
        title: module.title,
        description: textPreview(module.description || "Learning module"),
        href: "/app/materials",
        createdAt: module.createdAt
      })
    ),
    ...sessions.map((session) =>
      searchResult({
        id: session.id,
        type: "Session",
        title: session.title,
        description: `${session.module?.title || "Module session"}${session.startsAt ? ` · ${session.startsAt.toISOString().slice(0, 10)}` : ""}`,
        href: "/app",
        createdAt: session.createdAt
      })
    ),
    ...resources.map((resource) =>
      searchResult({
        id: resource.id,
        type: "Material",
        title: resource.title,
        description: textPreview(resource.description || resource.module?.title || resource.type),
        href: "/app/materials",
        createdAt: resource.createdAt
      })
    ),
    ...discussions.map((discussion) =>
      searchResult({
        id: discussion.id,
        type: "Forum",
        title: discussion.title,
        description: textPreview(discussion.body || discussion.comments?.[0]?.body || "Forum discussion"),
        href: "/app/forum",
        createdAt: discussion.updatedAt || discussion.createdAt
      })
    ),
    ...notifications.map((notification) =>
      searchResult({
        id: notification.id,
        type: "Notification",
        title: notification.title,
        description: textPreview(notification.previewText || notification.message),
        href: "/app/notifications",
        createdAt: notification.createdAt
      })
    )
  ]
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
    .slice(0, limit);

  res.json({ data: results, meta: { total: results.length, limit } });
});

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
    Notification.countDocuments({ recipient: req.user._id, readStatus: false, archivedAt: { $exists: false } }),
    Notification.find({ recipient: req.user._id, archivedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(5),
    Session.find({ cohort: cohortId, status: "scheduled", startsAt: { $gte: now } })
      .populate({
        path: "module",
        select: "title assignedMentor",
        populate: { path: "assignedMentor", select: "name email role profileImage" }
      })
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
      .populate({
        path: "module",
        select: "title assignedMentor",
        populate: { path: "assignedMentor", select: "name email role profileImage" }
      })
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
  const filter = attachAndFilters(
    {
      status: req.query.status || { $ne: "archived" }
    },
    [discussionAudienceFilter(studentDiscussionAudiences), discussionSearchFilter(req.query.search)]
  );

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
    audience: "all",
    status: "open"
  });

  await populateDiscussionDocument(discussion);
  res.status(201).json({ data: discussion });
});

export const updateStudentDiscussion = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findOne({
    _id: req.params.id,
    createdBy: req.user._id,
    status: { $ne: "archived" },
    $and: [discussionAudienceFilter(studentDiscussionAudiences)]
  });

  if (!discussion) {
    throw new ApiError(404, "Discussion not found");
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "title")) {
    discussion.title = sanitizePlainText(req.body.title);
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "body")) {
    discussion.body = sanitizeRichText(req.body.body || "");
  }

  await discussion.save();
  await populateDiscussionDocument(discussion);
  res.json({ data: discussion });
});

export const archiveStudentDiscussion = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findOne({
    _id: req.params.id,
    createdBy: req.user._id,
    status: { $ne: "archived" },
    $and: [discussionAudienceFilter(studentDiscussionAudiences)]
  });

  if (!discussion) {
    throw new ApiError(404, "Discussion not found");
  }

  discussion.status = "archived";
  await discussion.save();
  res.json({ data: { id: req.params.id, archived: true } });
});

export const replyStudentDiscussion = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findOne({
    _id: req.params.id,
    status: "open",
    $and: [discussionAudienceFilter(studentDiscussionAudiences)]
  });

  if (!discussion) {
    throw new ApiError(404, "Open discussion not found");
  }

  const parentComment = req.body.parentComment ? discussion.comments.id(req.body.parentComment) : null;
  if (req.body.parentComment && !parentComment) {
    throw new ApiError(404, "Parent reply not found");
  }

  const ownerId = parentComment?.createdBy || discussion.createdBy;
  const cleanBody = sanitizeRichText(req.body.body);

  discussion.comments.push({
    body: cleanBody,
    createdBy: req.user._id,
    parentComment: parentComment?._id
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
          message: `${req.user.name} replied to ${parentComment ? "your reply" : "your discussion"}.`,
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

export const updateStudentDiscussionComment = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findOne({
    _id: req.params.id,
    status: "open",
    $and: [discussionAudienceFilter(studentDiscussionAudiences)]
  });

  if (!discussion) {
    throw new ApiError(404, "Open discussion not found");
  }

  const comment = discussion.comments.id(req.params.commentId);
  if (!comment || String(comment.createdBy) !== String(req.user._id)) {
    throw new ApiError(404, "Reply not found");
  }

  comment.body = sanitizeRichText(req.body.body);
  await discussion.save();
  await populateDiscussionDocument(discussion);
  res.json({ data: discussion });
});

export const deleteStudentDiscussionComment = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findOne({
    _id: req.params.id,
    status: "open",
    $and: [discussionAudienceFilter(studentDiscussionAudiences)]
  });

  if (!discussion) {
    throw new ApiError(404, "Open discussion not found");
  }

  const comment = discussion.comments.id(req.params.commentId);
  if (!comment || String(comment.createdBy) !== String(req.user._id)) {
    throw new ApiError(404, "Reply not found");
  }

  removeCommentTree(discussion, req.params.commentId);
  await discussion.save();
  await populateDiscussionDocument(discussion);
  res.json({ data: discussion });
});

export const toggleStudentDiscussionReaction = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findOne({
    _id: req.params.id,
    status: { $ne: "archived" },
    $and: [discussionAudienceFilter(studentDiscussionAudiences)]
  });

  if (!discussion) {
    throw new ApiError(404, "Discussion not found");
  }

  toggleReaction(discussion.reactions, req.user._id, req.body.reaction);
  await discussion.save();
  await populateDiscussionDocument(discussion);
  res.json({ data: discussion });
});

export const toggleStudentDiscussionCommentReaction = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findOne({
    _id: req.params.id,
    status: "open",
    $and: [discussionAudienceFilter(studentDiscussionAudiences)]
  });

  if (!discussion) {
    throw new ApiError(404, "Open discussion not found");
  }

  const comment = discussion.comments.id(req.params.commentId);
  if (!comment) {
    throw new ApiError(404, "Reply not found");
  }

  toggleReaction(comment.reactions, req.user._id, req.body.reaction);
  await discussion.save();
  await populateDiscussionDocument(discussion);
  res.json({ data: discussion });
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
  if (!req.body.fileUrl && !req.body.linkUrl && !req.body.writtenResponse) {
    throw new ApiError(400, "Add a file, link, or written response before submitting");
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
    linkUrl: req.body.linkUrl,
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
          previewText: sanitizePlainText(req.body.writtenResponse || req.body.linkUrl || "A file submission was uploaded.").slice(0, 160),
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
  res.json({ data: await calculateStudentProgress(req.user) });
});

export const listStudentMentorAvailability = asyncHandler(async (req, res) => {
  const mentorIds = await studentMentorIds(req.user);

  if (!mentorIds.length) {
    res.json({ data: [], upcoming: [] });
    return;
  }

  const slots = await MentorAvailability.find({ mentor: { $in: mentorIds }, isActive: true })
    .populate("mentor", "name email profileImage bio expertise")
    .sort({ dayOfWeek: 1, startTime: 1 });

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
  const startsAt = new Date(req.body.startsAt);
  const requestedEndsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
  if (startsAt < new Date()) {
    throw new ApiError(400, "Choose a future time for your booking");
  }

  const mentorIds = await studentMentorIds(req.user);
  if (!mentorIds.length) {
    throw new ApiError(400, "No mentor is currently available for booking in your cohort");
  }

  const selectedSlot = req.body.availabilitySlot
    ? await MentorAvailability.findOne({ _id: req.body.availabilitySlot, isActive: true }).select("mentor")
    : null;
  const mentorId = idString(req.body.mentor || selectedSlot?.mentor || (mentorIds.length === 1 ? mentorIds[0] : ""));

  if (!mentorId) {
    throw new ApiError(400, "Choose a mentor availability slot before requesting a booking");
  }

  if (!mentorIds.includes(mentorId)) {
    throw new ApiError(403, "That mentor is not available to your cohort");
  }

  const { slot, endsAt } = await resolveBookingAvailability({
    mentorId,
    startsAt,
    requestedEndsAt,
    availabilitySlotId: req.body.availabilitySlot
  });

  const existingBooking = await Booking.findOne({
    mentor: mentorId,
    startsAt,
    status: { $in: ["pending", "approved"] }
  }).select("_id");

  if (existingBooking) {
    throw new ApiError(409, "That mentor availability slot already has a pending or approved booking");
  }

  const booking = await Booking.create({
    student: req.user._id,
    mentor: mentorId,
    availabilitySlot: slot._id,
    startsAt,
    endsAt,
    reason: sanitizeRichText(req.body.reason),
    status: "pending"
  });

  const mentor = await User.findById(mentorId).select("name email role");

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
    Notification.find({ recipient: req.user._id, archivedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments({ recipient: req.user._id, archivedAt: { $exists: false } })
  ]);

  res.json(paginatedResponse({ data: notifications, total, page, limit }));
});

export const markStudentNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id, archivedAt: { $exists: false } },
    { readStatus: true },
    { new: true }
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  res.json({ data: notification });
});
