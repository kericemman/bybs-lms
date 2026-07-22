import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { connectDatabase, stopDatabase } from "../config/database.js";
import { Assignment } from "../models/Assignment.js";
import { BetaApplication } from "../models/BetaApplication.js";
import { BetaFeedback } from "../models/BetaFeedback.js";
import { Booking } from "../models/Booking.js";
import { Certificate } from "../models/Certificate.js";
import { Cohort } from "../models/Cohort.js";
import { Discussion } from "../models/Discussion.js";
import { MentorAvailability } from "../models/MentorAvailability.js";
import { Module } from "../models/Module.js";
import { Notification } from "../models/Notification.js";
import { Reminder } from "../models/Reminder.js";
import { Report } from "../models/Report.js";
import { Resource } from "../models/Resource.js";
import { Session } from "../models/Session.js";
import { Submission } from "../models/Submission.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { SystemLog } from "../models/SystemLog.js";
import { User } from "../models/User.js";

const CONFIRM_PHRASE = "ARCHIVE_AND_RESET_PROGRAM_DATA";
const args = process.argv.slice(2);
const shouldShowHelp = args.includes("--help") || args.includes("-h");
const shouldIncludeSystemLogs = args.includes("--include-system-logs");
const confirmArg = args.find((arg) => arg.startsWith("--confirm"));
const confirmValue = confirmArg?.includes("=") ? confirmArg.split("=").slice(1).join("=") : "";
const shouldApply = confirmValue === CONFIRM_PHRASE;

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function printHelp() {
  console.log(`BYBS LMS program archive and reset

Usage:
  npm --workspace backend run cleanup:program
  npm --workspace backend run cleanup:program -- --confirm=${CONFIRM_PHRASE}
  npm --workspace backend run cleanup:program -- --confirm=${CONFIRM_PHRASE} --include-system-logs

Default behavior:
  - Dry run only. No records are deleted.
  - Archives records into backend/archives/program-reset-<timestamp>/ before deletion.
  - Deletes mentors, mentees, cohorts, modules, sessions, resources, assignments, submissions, bookings,
    reports, reminders, certificates, discussions, support tickets, beta applications, beta feedback,
    mentor availability, and mentor/mentee notifications.
  - Keeps admin, admin manager, and super admin users.
  - Keeps system logs unless --include-system-logs is used.

Confirmation phrase:
  --confirm=${CONFIRM_PHRASE}`);
}

function archiveFolder() {
  return path.resolve(process.cwd(), "archives", `program-reset-${timestamp()}`);
}

async function readDocuments(model, filter) {
  return model.find(filter).lean();
}

async function archiveCollection({ folder, key, model, filter }) {
  const documents = await readDocuments(model, filter);
  const filePath = path.join(folder, `${key}.json`);
  await writeFile(filePath, `${JSON.stringify(documents, null, 2)}\n`);
  return {
    key,
    count: documents.length,
    file: filePath
  };
}

async function countCollections(collections) {
  const counts = {};

  for (const collection of collections) {
    counts[collection.key] = await collection.model.countDocuments(collection.filter);
  }

  return counts;
}

function printCounts(counts, folder) {
  console.log("BYBS LMS program archive and reset");
  console.log("");
  console.log(`Archive folder: ${folder}`);
  console.log("");

  for (const [key, count] of Object.entries(counts)) {
    console.log(`${key}: ${count}`);
  }

  console.log("");
  console.log("Dry run by default. No records are deleted unless the exact confirmation phrase is supplied.");
  console.log(`Apply with: npm --workspace backend run cleanup:program -- --confirm=${CONFIRM_PHRASE}`);
}

async function archiveProgramReset() {
  await connectDatabase();

  const programUserFilter = { role: { $in: ["mentor", "student"] } };
  const programUsers = await User.find(programUserFilter).select("_id").lean();
  const programUserIds = programUsers.map((user) => user._id);
  const programNotificationFilter = {
    $or: [
      { recipient: { $in: programUserIds } },
      { type: { $in: ["assignment", "booking", "support", "reminder"] } }
    ]
  };

  const collections = [
    { key: "users-mentors-mentees", model: User, filter: programUserFilter },
    { key: "cohorts", model: Cohort, filter: {} },
    { key: "modules", model: Module, filter: {} },
    { key: "sessions", model: Session, filter: {} },
    { key: "resources", model: Resource, filter: {} },
    { key: "assignments", model: Assignment, filter: {} },
    { key: "submissions", model: Submission, filter: {} },
    { key: "mentor-availability", model: MentorAvailability, filter: {} },
    { key: "bookings", model: Booking, filter: {} },
    { key: "reports", model: Report, filter: {} },
    { key: "certificates", model: Certificate, filter: {} },
    { key: "discussions", model: Discussion, filter: {} },
    { key: "reminders", model: Reminder, filter: {} },
    { key: "support-tickets", model: SupportTicket, filter: {} },
    { key: "notifications-program", model: Notification, filter: programNotificationFilter },
    { key: "beta-applications", model: BetaApplication, filter: {} },
    { key: "beta-feedback", model: BetaFeedback, filter: {} }
  ];

  if (shouldIncludeSystemLogs) {
    collections.push({ key: "system-logs", model: SystemLog, filter: {} });
  }

  const folder = archiveFolder();
  const counts = await countCollections(collections);
  printCounts(counts, folder);

  if (!shouldApply) {
    console.log("");
    console.log("Dry run complete. No archive files were written and no records were deleted.");
    return;
  }

  await mkdir(folder, { recursive: true });

  const archivedCollections = [];
  for (const collection of collections) {
    archivedCollections.push(await archiveCollection({ folder, ...collection }));
  }

  const deleteResults = [];
  for (const collection of collections) {
    const result = await collection.model.deleteMany(collection.filter);
    deleteResults.push({
      key: collection.key,
      deletedCount: result.deletedCount || 0
    });
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    confirmation: CONFIRM_PHRASE,
    includeSystemLogs: shouldIncludeSystemLogs,
    archivedCollections,
    deleteResults,
    preserved: {
      users: ["admin", "adminManager", "superAdmin"],
      systemLogs: shouldIncludeSystemLogs ? "archived and deleted" : "preserved"
    }
  };

  await writeFile(path.join(folder, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log("");
  console.log("Archive and reset complete.");
  for (const result of deleteResults) {
    console.log(`Deleted ${result.key}: ${result.deletedCount}`);
  }
  console.log("");
  console.log(`Archive saved to: ${folder}`);
}

if (shouldShowHelp) {
  printHelp();
} else {
  archiveProgramReset()
    .catch((error) => {
      console.error("Failed to archive and reset program data", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await stopDatabase();
    });
}
