import { env } from "../config/env.js";
import { Assignment } from "../models/Assignment.js";
import { Submission } from "../models/Submission.js";
import { User } from "../models/User.js";
import { formatAssignmentDeadlineForNotification } from "../utils/assignmentDeadlines.js";
import { logger } from "../utils/logger.js";
import { notificationLinks } from "../utils/notificationLinks.js";
import { notifyUserOnce } from "./portalNotificationService.js";

const assignmentTimeZone = process.env.ASSIGNMENT_DEADLINE_TIME_ZONE || "Africa/Juba";
const hourMs = 60 * 60 * 1000;
const actionableSubmissionStatuses = new Set(["notStarted", "needsRevision"]);

let intervalHandle = null;
let isRunning = false;

function idFor(value) {
  return String(value?._id || value?.id || value || "");
}

function zonedDateParts(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: assignmentTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour === "24" ? "00" : values.hour)
  };
}

function reminderStage(deadline, now) {
  const remainingHours = (deadline.getTime() - now.getTime()) / hourMs;
  if (remainingHours <= 0) return null;

  const deadlineParts = zonedDateParts(deadline);
  const nowParts = zonedDateParts(now);
  const dueDayHour = Math.min(23, Math.max(0, env.assignmentReminderDueDayHour));

  if (deadlineParts.date === nowParts.date && nowParts.hour >= dueDayHour) {
    return { key: "due-today", label: "due today" };
  }

  const leadHours = [...env.assignmentReminderLeadHours].sort((left, right) => left - right);
  const activeLead = leadHours.find((hours) => remainingHours <= hours);

  return activeLead
    ? { key: `lead-${activeLead}h`, label: `due within ${activeLead} hours`, hours: activeLead }
    : null;
}

function deliveryKey({ assignment, recipient, stage }) {
  const deadline = new Date(assignment.dueDate).toISOString();
  return `assignment-reminder:v1:${assignment._id}:${recipient._id}:${stage.key}:deadline-${deadline}`;
}

function reminderNotification({ assignment, submission, stage }) {
  const needsRevision = submission?.status === "needsRevision";
  const moduleTitle = assignment.module?.title || "General assignment";
  const deadline = formatAssignmentDeadlineForNotification(assignment.dueDate);
  const action = needsRevision
    ? "Your mentor requested changes. Review the feedback and submit your revised attempt before the deadline."
    : "Open the assignment, complete the required work, and submit it before the deadline.";
  const titlePrefix = needsRevision ? "Revision" : "Assignment";

  return {
    title: `${titlePrefix} ${stage.label}: ${assignment.title}`,
    message: [
      `${titlePrefix}: ${assignment.title}`,
      `Module: ${moduleTitle}`,
      `Deadline: ${deadline}`,
      action
    ].join("\n"),
    channel: "both",
    previewText: `${assignment.title} is ${stage.label}. ${needsRevision ? "A revision is still required." : "Your submission is still pending."}`,
    type: "reminder",
    ctaLabel: needsRevision ? "Open feedback and revise" : "Open assignment",
    ctaUrl: notificationLinks.studentAssignment(assignment._id),
    targetType: "assignment",
    targetRole: "student",
    targetLabel: assignment.title,
    readStatus: false
  };
}

function isReminderRecipient(submission) {
  return !submission || actionableSubmissionStatuses.has(submission.status);
}

async function assignmentsInReminderWindow(now) {
  const maxLeadHours = Math.max(...env.assignmentReminderLeadHours, 24);
  const horizon = new Date(now.getTime() + maxLeadHours * hourMs);

  return Assignment.find({
    status: "published",
    dueDate: { $gt: now, $lte: horizon }
  })
    .select("title dueDate cohort module status")
    .populate("cohort", "title status")
    .populate("module", "title status")
    .sort({ dueDate: 1 })
    .limit(env.assignmentReminderBatchSize);
}

async function runLimited(items, worker, limit = 8) {
  const results = [];
  let index = 0;

  async function run() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export async function runAssignmentDeadlineReminderJob({ now = new Date() } = {}) {
  if (isRunning) {
    return { skipped: true, reason: "alreadyRunning" };
  }

  isRunning = true;

  try {
    const assignments = await assignmentsInReminderWindow(now);
    const stagedAssignments = assignments
      .map((assignment) => ({ assignment, stage: reminderStage(new Date(assignment.dueDate), now) }))
      .filter(({ assignment, stage }) => assignment.cohort?.status === "active" && stage);
    const cohortIds = [...new Set(stagedAssignments.map(({ assignment }) => idFor(assignment.cohort)))];

    if (!stagedAssignments.length || !cohortIds.length) {
      return { sent: 0, skipped: 0, failed: 0, candidates: 0, scanned: assignments.length };
    }

    const students = await User.find({
      role: "student",
      status: "active",
      cohort: { $in: cohortIds }
    }).select("name email role cohort status");
    const assignmentIds = stagedAssignments.map(({ assignment }) => assignment._id);
    const studentIds = students.map((student) => student._id);
    const submissions = await Submission.find({
      assignment: { $in: assignmentIds },
      student: { $in: studentIds }
    }).select("assignment student status");
    const studentsByCohort = new Map();
    const submissionsByAssignmentAndStudent = new Map();

    students.forEach((student) => {
      const cohortId = idFor(student.cohort);
      if (!studentsByCohort.has(cohortId)) studentsByCohort.set(cohortId, []);
      studentsByCohort.get(cohortId).push(student);
    });
    submissions.forEach((submission) => {
      submissionsByAssignmentAndStudent.set(
        `${idFor(submission.assignment)}:${idFor(submission.student)}`,
        submission
      );
    });

    const candidates = [];

    stagedAssignments.forEach(({ assignment, stage }) => {
      const cohortStudents = studentsByCohort.get(idFor(assignment.cohort)) || [];

      cohortStudents.forEach((recipient) => {
        const submission = submissionsByAssignmentAndStudent.get(`${idFor(assignment)}:${idFor(recipient)}`);
        if (!isReminderRecipient(submission)) return;
        candidates.push({ assignment, recipient, stage, submission });
      });
    });

    const deliveries = await runLimited(candidates, async (candidate) => {
      try {
        const result = await notifyUserOnce({
          recipient: candidate.recipient,
          portalRole: "student",
          uniqueKey: deliveryKey(candidate),
          notification: reminderNotification(candidate)
        });
        return { created: result.created };
      } catch (error) {
        logger.error(
          {
            err: error,
            assignmentId: idFor(candidate.assignment),
            recipientId: idFor(candidate.recipient),
            stage: candidate.stage.key
          },
          "Assignment reminder delivery failed"
        );
        return { created: false, failed: true };
      }
    });
    const sent = deliveries.filter((delivery) => delivery.created).length;
    const failed = deliveries.filter((delivery) => delivery.failed).length;
    const skipped = deliveries.length - sent - failed;
    const result = {
      sent,
      skipped,
      failed,
      candidates: candidates.length,
      scanned: assignments.length
    };

    if (sent || skipped || failed) {
      logger.info(result, "Assignment deadline reminder job completed");
    }

    return result;
  } catch (error) {
    logger.error({ err: error }, "Assignment deadline reminder job failed");
    return { error: error.message };
  } finally {
    isRunning = false;
  }
}

export function startAssignmentReminderScheduler() {
  if (!env.assignmentReminderJobEnabled || intervalHandle) {
    return () => {};
  }

  runAssignmentDeadlineReminderJob().catch((error) => {
    logger.error({ err: error }, "Initial assignment reminder job failed");
  });

  intervalHandle = setInterval(() => {
    runAssignmentDeadlineReminderJob().catch((error) => {
      logger.error({ err: error }, "Scheduled assignment reminder job failed");
    });
  }, env.assignmentReminderIntervalMs);

  logger.info(
    {
      intervalMs: env.assignmentReminderIntervalMs,
      leadHours: env.assignmentReminderLeadHours,
      dueDayHour: env.assignmentReminderDueDayHour,
      timeZone: assignmentTimeZone
    },
    "Assignment reminder scheduler started"
  );

  return stopAssignmentReminderScheduler;
}

export function stopAssignmentReminderScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
