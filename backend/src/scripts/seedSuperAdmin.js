import { connectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

const email = env.superAdminEmail;
const password = env.superAdminPassword || process.env.SUPER_ADMIN_PASSWORD || "";
const name = env.superAdminName;

async function seedSuperAdmin() {
  await connectDatabase();

  const existingAdmin = await User.findOne({ email: email.toLowerCase() });

  if (existingAdmin) {
    console.log(`Super admin already exists: ${email}`);
    process.exit(0);
  }

  if (!password || password.length < 12) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 12 characters.");
  }

  const passwordHash = await User.hashPassword(password);

  await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: "superAdmin",
    status: "active",
    passwordResetRequired: true
  });

  console.log(`Super admin created: ${email}`);
  console.log("Change this password after first login.");
  process.exit(0);
}

seedSuperAdmin().catch((error) => {
  console.error("Failed to seed super admin", error);
  process.exit(1);
});
