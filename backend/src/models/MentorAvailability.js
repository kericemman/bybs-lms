import mongoose from "mongoose";

const mentorAvailabilitySchema = new mongoose.Schema(
  {
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dayOfWeek: {
      type: String,
      enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
      required: true
    },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

mentorAvailabilitySchema.index({ mentor: 1, dayOfWeek: 1 });

export const MentorAvailability = mongoose.model("MentorAvailability", mentorAvailabilitySchema);
