import mongoose from "mongoose";

const reminderDeliverySchema = new mongoose.Schema(
  {
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    notConfigured: { type: Number, default: 0 }
  },
  { _id: false }
);

const reminderSchema = new mongoose.Schema(
  {
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true, index: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: "Cohort", index: true },
    target: {
      type: String,
      enum: ["notSubmitted", "lateSubmission", "needsRevision", "allAssigned"],
      default: "notSubmitted",
      index: true
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    recipientCount: { type: Number, default: 0 },
    notificationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Notification" }],
    emailDelivery: { type: reminderDeliverySchema, default: () => ({}) },
    status: {
      type: String,
      enum: ["sent", "archived"],
      default: "sent",
      index: true
    },
    sentAt: { type: Date, default: Date.now },
    editedAt: { type: Date },
    archivedAt: { type: Date },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export const Reminder = mongoose.model("Reminder", reminderSchema);
