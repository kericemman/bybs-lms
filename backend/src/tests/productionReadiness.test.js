import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "memory";
process.env.SEED_SUPER_ADMIN_ON_START = "false";
process.env.REQUIRE_COMPRESSED_UPLOADS = "true";
process.env.RESEND_API_KEY = "";
process.env.JWT_SECRET = "test-secret-with-more-than-32-characters";

const request = (await import("supertest")).default;
const mongoose = (await import("mongoose")).default;
const { app } = await import("../app.js");
const { connectDatabase, stopDatabase } = await import("../config/database.js");
const { BetaApplication } = await import("../models/BetaApplication.js");
const { User } = await import("../models/User.js");
const { changePasswordSchema } = await import("../validators/authSchemas.js");

let databaseReady = false;
let databaseError = null;

async function createUser({
  name = "Test User",
  email,
  password = "TempPass123!",
  role = "admin",
  status = "active",
  passwordResetRequired = false
}) {
  return User.create({
    name,
    email,
    role,
    status,
    passwordHash: await User.hashPassword(password),
    passwordResetRequired
  });
}

async function login(email, password) {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password })
    .expect(200);

  return response.body;
}

before(async () => {
  try {
    await connectDatabase();
    databaseReady = true;
  } catch (error) {
    databaseError = error;
  }
});

beforeEach(async () => {
  if (!databaseReady) return;
  await mongoose.connection.db.dropDatabase();
});

after(async () => {
  if (!databaseReady) return;
  await stopDatabase();
});

function requireDatabase(t) {
  if (!databaseReady) {
    t.skip(`Embedded MongoDB unavailable in this environment: ${databaseError?.message || "unknown error"}`);
    return false;
  }

  return true;
}

describe("production readiness controls", () => {
  test("password policy requires strong replacement passwords", () => {
    assert.throws(() => changePasswordSchema.parse({
      body: {
        currentPassword: "TempPass123!",
        newPassword: "short"
      }
    }));

    assert.doesNotThrow(() => changePasswordSchema.parse({
      body: {
        currentPassword: "TempPass123!",
        newPassword: "NewSecurePass123!"
      }
    }));
  });

  test("users with temporary passwords can change them and clear reset requirement", async (t) => {
    if (!requireDatabase(t)) return;
    await createUser({
      email: "student@example.com",
      role: "student",
      password: "TempPass123!",
      passwordResetRequired: true
    });

    const loginResponse = await login("student@example.com", "TempPass123!");
    assert.equal(loginResponse.user.passwordResetRequired, true);

    const changeResponse = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${loginResponse.token}`)
      .send({
        currentPassword: "TempPass123!",
        newPassword: "NewSecurePass123!"
      })
      .expect(200);

    assert.equal(changeResponse.body.user.passwordResetRequired, false);

    const nextLoginResponse = await login("student@example.com", "NewSecurePass123!");
    assert.equal(nextLoginResponse.user.passwordResetRequired, false);
  });

  test("accepting a beta application creates tester access even when email is not configured", async (t) => {
    if (!requireDatabase(t)) return;
    await createUser({
      email: "admin@example.com",
      role: "superAdmin",
      password: "AdminPass123!"
    });
    const { token } = await login("admin@example.com", "AdminPass123!");

    const application = await BetaApplication.create({
      applicantType: "student",
      name: "Beta Student",
      email: "beta.student@example.com",
      phone: "+211912345678",
      motivation: "I want to help test BYBS LMS because clear student feedback will help improve the platform.",
      consent: true
    });

    const response = await request(app)
      .patch(`/api/admin/beta-applications/${application._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "accepted" })
      .expect(200);

    assert.equal(response.body.data.status, "accepted");
    assert.equal(response.body.data.testerAccountStatus, "created");
    assert.equal(response.body.data.acceptanceEmailStatus, "notConfigured");

    const tester = await User.findOne({ email: "beta.student@example.com" });
    assert.equal(tester.role, "student");
    assert.equal(tester.passwordResetRequired, true);
  });

  test("resource uploads that bypass BYBS compression metadata are rejected", async (t) => {
    if (!requireDatabase(t)) return;
    await createUser({
      email: "admin@example.com",
      role: "superAdmin",
      password: "AdminPass123!"
    });
    const { token } = await login("admin@example.com", "AdminPass123!");

    const response = await request(app)
      .post("/api/admin/resources/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("plain upload"), {
        filename: "notes.txt",
        contentType: "text/plain"
      })
      .expect(400);

    assert.match(response.body.message, /compressed/i);
  });
});
