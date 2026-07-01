import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date },
    reason: { type: String, required: true },
    meetingLink: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "declined", "completed", "cancelled"],
      default: "pending",
      index: true
    },
    mentorNotes: { type: String }
  },
  { timestamps: true }
);

export const Booking = mongoose.model("Booking", bookingSchema);
