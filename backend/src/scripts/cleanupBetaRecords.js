import mongoose from "mongoose";
import { connectDatabase, stopDatabase } from "../config/database.js";
import { BetaApplication } from "../models/BetaApplication.js";
import { BetaFeedback } from "../models/BetaFeedback.js";
import { User } from "../models/User.js";

const args = new Set(process.argv.slice(2));
const shouldShowHelp = args.has("--help") || args.has("-h");
const shouldConfirm = args.has("--confirm");
const shouldDeleteBetaCreatedUsers = args.has("--delete-beta-created-users");

function printHelp() {
  console.log(`BYBS LMS beta record cleanup

Usage:
  npm --workspace backend run cleanup:beta
  npm --workspace backend run cleanup:beta -- --confirm
  npm --workspace backend run cleanup:beta -- --confirm --delete-beta-created-users

Options:
  --confirm                    Apply the cleanup. Without this flag, the command is a dry run.
  --delete-beta-created-users   Also delete user accounts created by the beta acceptance flow.
  --help                       Show this help message.

The command uses backend/.env through the normal backend environment loader.
Default cleanup deletes BetaApplication and BetaFeedback records only.`);
}

function uniqueObjectIds(values) {
  const ids = new Set();

  for (const value of values) {
    if (!value) continue;
    const id = String(value);
    if (mongoose.Types.ObjectId.isValid(id)) ids.add(id);
  }

  return [...ids];
}

function printPlan({ applicationCount, feedbackCount, betaCreatedUserCount, betaCreatedUsers }) {
  console.log("BYBS LMS beta record cleanup");
  console.log("");
  console.log(`Beta applications: ${applicationCount}`);
  console.log(`Beta feedback records: ${feedbackCount}`);
  console.log(`Beta-created linked user accounts: ${betaCreatedUserCount}`);

  if (betaCreatedUsers.length) {
    console.log("");
    console.log("Beta-created user accounts found:");
    for (const user of betaCreatedUsers) {
      console.log(`- ${user.name} <${user.email}> (${user.role}, ${user.status})`);
    }
  }

  console.log("");
  console.log("Default cleanup deletes beta applications and beta feedback only.");
  console.log("Use --delete-beta-created-users to also delete user accounts created by the beta acceptance flow.");
  console.log("Use --confirm to apply the cleanup. Without --confirm this is a dry run.");
}

async function cleanupBetaRecords() {
  await connectDatabase();

  const betaCreatedApplications = await BetaApplication.find({
    testerAccountStatus: "created",
    testerUser: { $exists: true, $ne: null }
  }).select("testerUser");

  const betaCreatedUserIds = uniqueObjectIds(betaCreatedApplications.map((application) => application.testerUser));

  const [applicationCount, feedbackCount, betaCreatedUsers] = await Promise.all([
    BetaApplication.countDocuments({}),
    BetaFeedback.countDocuments({}),
    User.find({ _id: { $in: betaCreatedUserIds } }).select("name email role status").sort({ role: 1, email: 1 })
  ]);

  printPlan({
    applicationCount,
    feedbackCount,
    betaCreatedUserCount: betaCreatedUsers.length,
    betaCreatedUsers
  });

  if (!shouldConfirm) {
    console.log("");
    console.log("Dry run complete. No records were deleted.");
    return;
  }

  const deleteOperations = [
    BetaFeedback.deleteMany({}),
    BetaApplication.deleteMany({})
  ];

  if (shouldDeleteBetaCreatedUsers && betaCreatedUserIds.length) {
    deleteOperations.push(User.deleteMany({ _id: { $in: betaCreatedUserIds } }));
  }

  const [feedbackResult, applicationResult, userResult] = await Promise.all(deleteOperations);

  console.log("");
  console.log("Cleanup complete.");
  console.log(`Deleted beta feedback records: ${feedbackResult.deletedCount || 0}`);
  console.log(`Deleted beta applications: ${applicationResult.deletedCount || 0}`);
  console.log(`Deleted beta-created user accounts: ${userResult?.deletedCount || 0}`);
}

if (shouldShowHelp) {
  printHelp();
} else {
  cleanupBetaRecords()
    .catch((error) => {
      console.error("Failed to clean beta records", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await stopDatabase();
    });
}
