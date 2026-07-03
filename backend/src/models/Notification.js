import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    announcementId: { type: String, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    templateTitle: { type: String },
    templateMessage: { type: String },
    templatePreviewText: { type: String },
    channel: {
      type: String,
      enum: ["platform", "email", "both"],
      default: "platform",
      index: true
    },
    previewText: { type: String },
    ctaLabel: { type: String },
    ctaUrl: { type: String },
    targetType: { type: String },
    targetRole: { type: String },
    targetLabel: { type: String },
    emailDeliveryStatus: {
      type: String,
      enum: ["notRequested", "notConfigured", "pending", "sent", "failed"],
      default: "notRequested",
      index: true
    },
    emailDeliveryError: { type: String },
    emailSentAt: { type: Date },
    type: {
      type: String,
      enum: ["announcement", "assignment", "booking", "support", "reminder", "system"],
      default: "system",
      index: true
    },
    readStatus: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

export const Notification = mongoose.model("Notification", notificationSchema);
