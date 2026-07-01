import { env } from "../config/env.js";
import { User } from "../models/User.js";

export async function ensureSuperAdmin() {
  if (!env.seedSuperAdminOnStart) {
    return null;
  }

  if (!env.superAdminPassword || env.superAdminPassword.length < 12) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 12 characters when auto-seeding.");
  }

  const email = env.superAdminEmail.toLowerCase();
  const existingAdmin = await User.findOne({ email });

  if (existingAdmin) {
    console.log(`Super admin ready: ${email}`);
    return existingAdmin;
  }

  const passwordHash = await User.hashPassword(env.superAdminPassword);
  const admin = await User.create({
    name: env.superAdminName,
    email,
    passwordHash,
    role: "superAdmin",
    status: "active",
    passwordResetRequired: true
  });

  console.log(`Super admin seeded: ${email}`);
  return admin;
}
