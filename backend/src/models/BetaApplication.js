import mongoose from "mongoose";

const betaApplicationSources = [
  "",
  "BYBS website",
  "BYBS mentor",
  "BYBS student",
  "WhatsApp",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Email",
  "Friend or referral",
  "Community event",
  "Other"
];

const betaApplicationSchema = new mongoose.Schema(
  {
    applicantType: {
      type: String,
      enum: ["student", "mentor"],
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true },
    location: { type: String, trim: true },
    experienceLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "mentor", "notSet"],
      default: "notSet"
    },
    availability: { type: String, trim: true },
    motivation: { type: String, required: true },
    source: { type: String, enum: betaApplicationSources, trim: true },
    consent: { type: Boolean, required: true },
    status: {
      type: String,
      enum: ["new", "reviewing", "accepted", "waitlisted", "rejected"],
      default: "new",
      index: true
    },
    adminNotes: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    acceptanceEmailStatus: {
      type: String,
      enum: ["notRequested", "sent", "failed", "notConfigured"],
      default: "notRequested"
    },
    acceptanceEmailError: { type: String },
    acceptanceEmailSentAt: { type: Date },
    testerUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    testerAccountStatus: {
      type: String,
      enum: ["notRequested", "created", "existing", "failed"],
      default: "notRequested"
    },
    testerAccountError: { type: String },
    testerAccountCreatedAt: { type: Date }
  },
  { timestamps: true }
);

betaApplicationSchema.index({ applicantType: 1, status: 1, createdAt: -1 });
betaApplicationSchema.index({ email: 1, applicantType: 1 }, { unique: true });

export const BetaApplication = mongoose.model("BetaApplication", betaApplicationSchema);
