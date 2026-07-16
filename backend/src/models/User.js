import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["student", "mentor", "admin", "adminManager", "superAdmin"],
      required: true,
      index: true
    },
    profileImage: { type: String },
    bio: { type: String },
    expertise: [{ type: String }],
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: "Cohort", index: true },
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "removed", "completed"],
      default: "active",
      index: true
    },
    passwordResetRequired: { type: Boolean, default: false, index: true },
    passwordResetTokenHash: { type: String, select: false, index: true },
    passwordResetExpiresAt: { type: Date, select: false },
    passwordResetRequestedAt: { type: Date, select: false },
    passwordChangedAt: { type: Date },
    lastLogin: { type: Date }
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 12);
};

export const User = mongoose.model("User", userSchema);
