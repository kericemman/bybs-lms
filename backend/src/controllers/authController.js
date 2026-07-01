import { User } from "../models/User.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { signAccessToken } from "../utils/jwt.js";

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    profileImage: user.profileImage,
    cohort: user.cohort,
    mentor: user.mentor,
    passwordResetRequired: Boolean(user.passwordResetRequired),
    passwordChangedAt: user.passwordChangedAt
  };
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");

  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid login credentials");
  }

  if (user.status !== "active") {
    throw new ApiError(403, "Your account is not active");
  }

  user.lastLogin = new Date();
  await user.save();

  res.json({
    token: signAccessToken(user),
    user: publicUser(user)
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+passwordHash");

  if (!user) {
    throw new ApiError(401, "Invalid or inactive account");
  }

  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(400, "Current password is incorrect");
  }

  if (await user.comparePassword(newPassword)) {
    throw new ApiError(400, "New password must be different from the current password");
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.passwordResetRequired = false;
  user.passwordChangedAt = new Date();
  await user.save();

  res.json({ user: publicUser(user) });
});
