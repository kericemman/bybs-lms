import { env } from "../config/env.js";
import { Session } from "../models/Session.js";
import { logger } from "../utils/logger.js";
import { sanitizePlainText } from "../utils/sanitizeRichText.js";
import { notifyUserOnce } from "./portalNotificationService.js";

let intervalHandle = null;
let isRunning = false;

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function catDateTime(value) {
  return `${new Intl.DateTimeFormat("en", {
    timeZone: "Africa/Maputo",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value))} CAT`;
}

function mentorForSession(session) {
  return session.module?.assignedMentor || null;
}

function sessionReminderKey({ session, mentor }) {
  return `session-reminder:v1:${session._id}:${mentor._id || mentor}:lead-${env.sessionReminderLeadHours}h`;
}

function sessionReminderNotification(session) {
  const moduleTitle = session.module?.title || "your assigned module";
  const cohortTitle = session.cohort?.title || "your cohort";
  const sessionTime = catDateTime(session.startsAt);
  const plainDescription = sanitizePlainText(session.description || "");
  const details = [
    `Your BYBS session "${session.title}" is scheduled for ${sessionTime}.`,
    `Module: ${moduleTitle}.`,
    `Cohort: ${cohortTitle}.`,
    plainDescription ? `Notes: ${plainDescription.slice(0, 220)}` : "",
    "Please prepare your slides, session flow, attendance link, and post-session assignment materials."
  ].filter(Boolean);

  return {
    title: `Session reminder: ${session.title}`,
    message: details.join("\n"),
    channel: "both",
    previewText: `${session.title} is coming up on ${sessionTime}.`,
    type: "reminder",
    ctaLabel: "Prepare session",
    ctaUrl: "/session-work",
    targetType: "session",
    targetRole: "mentor",
    targetLabel: session.title,
    readStatus: false
  };
}

async function sessionsNeedingReminder(now = new Date()) {
  const reminderAt = addHours(now, env.sessionReminderLeadHours);
  const windowStart = addMinutes(reminderAt, -Math.floor(env.sessionReminderWindowMinutes / 2));
  const windowEnd = addMinutes(reminderAt, Math.ceil(env.sessionReminderWindowMinutes / 2));

  return Session.find({
    status: "scheduled",
    startsAt: {
      $gte: windowStart,
      $lte: windowEnd
    },
    module: { $exists: true, $ne: null }
  })
    .populate("cohort", "title status")
    .populate({
      path: "module",
      select: "title description status assignedMentor startDate endDate",
      populate: { path: "assignedMentor", select: "name email role status" }
    })
    .sort({ startsAt: 1 })
    .limit(200);
}

export async function runSessionReminderJob({ now = new Date() } = {}) {
  if (isRunning) {
    return { skipped: true, reason: "alreadyRunning" };
  }

  isRunning = true;

  try {
    const sessions = await sessionsNeedingReminder(now);
    let sent = 0;
    let skipped = 0;

    for (const session of sessions) {
      const mentor = mentorForSession(session);

      if (!mentor || mentor.role !== "mentor" || mentor.status !== "active") {
        skipped += 1;
        continue;
      }

      const result = await notifyUserOnce({
        recipient: mentor,
        portalRole: "mentor",
        uniqueKey: sessionReminderKey({ session, mentor }),
        notification: sessionReminderNotification(session)
      });

      if (result.created) {
        sent += 1;
      } else {
        skipped += 1;
      }
    }

    if (sent || skipped) {
      logger.info({ sent, skipped, scanned: sessions.length }, "Session reminder job completed");
    }

    return { sent, skipped, scanned: sessions.length };
  } catch (error) {
    logger.error({ err: error }, "Session reminder job failed");
    return { error: error.message };
  } finally {
    isRunning = false;
  }
}

export function startSessionReminderScheduler() {
  if (!env.sessionReminderJobEnabled || intervalHandle) {
    return () => {};
  }

  runSessionReminderJob().catch((error) => {
    logger.error({ err: error }, "Initial session reminder job failed");
  });

  intervalHandle = setInterval(() => {
    runSessionReminderJob().catch((error) => {
      logger.error({ err: error }, "Scheduled session reminder job failed");
    });
  }, env.sessionReminderIntervalMs);

  logger.info(
    {
      intervalMs: env.sessionReminderIntervalMs,
      leadHours: env.sessionReminderLeadHours,
      windowMinutes: env.sessionReminderWindowMinutes
    },
    "Session reminder scheduler started"
  );

  return stopSessionReminderScheduler;
}

export function stopSessionReminderScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
