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
const { Assignment } = await import("../models/Assignment.js");
const { BetaApplication } = await import("../models/BetaApplication.js");
const { Cohort } = await import("../models/Cohort.js");
const { Module } = await import("../models/Module.js");
const { User } = await import("../models/User.js");
const { changePasswordSchema, updateProfileSchema } = await import("../validators/authSchemas.js");

let databaseReady = false;
let databaseError = null;

async function createUser({
  name = "Test User",
  email,
  password = "TempPass123!",
  role = "admin",
  status = "active",
  passwordResetRequired = false,
  ...rest
}) {
  return User.create({
    name,
    email,
    role,
    status,
    passwordHash: await User.hashPassword(password),
    passwordResetRequired,
    ...rest
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

  test("self profile updates only accept safe public profile fields", () => {
    const parsed = updateProfileSchema.parse({
      body: {
        name: "Mentor Profile",
        phone: "+211912345678",
        bio: "Short BYBS profile",
        email: "changed@example.com",
        role: "superAdmin",
        status: "removed"
      }
    });

    assert.deepEqual(Object.keys(parsed.body).sort(), ["bio", "name", "phone"]);
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

  test("mentors can edit only assignments they created", async (t) => {
    if (!requireDatabase(t)) return;

    const mentorA = await createUser({
      name: "Mentor A",
      email: "mentor.a@example.com",
      role: "mentor",
      password: "MentorPass123!"
    });
    const mentorB = await createUser({
      name: "Mentor B",
      email: "mentor.b@example.com",
      role: "mentor",
      password: "MentorPass123!"
    });
    const cohort = await Cohort.create({
      title: "Cohort Ownership",
      status: "active",
      mentors: [mentorA._id, mentorB._id]
    });
    const module = await Module.create({
      title: "Shared Module",
      cohort: cohort._id,
      status: "published"
    });
    const ownAssignment = await Assignment.create({
      title: "Own Assignment",
      instructions: "Complete the reflection and submit your notes.",
      cohort: cohort._id,
      module: module._id,
      dueDate: new Date(Date.now() + 86400000),
      createdBy: mentorA._id,
      status: "published"
    });
    const otherAssignment = await Assignment.create({
      title: "Other Assignment",
      instructions: "This assignment belongs to another mentor.",
      cohort: cohort._id,
      module: module._id,
      dueDate: new Date(Date.now() + 86400000),
      createdBy: mentorB._id,
      status: "published"
    });

    const { token } = await login("mentor.a@example.com", "MentorPass123!");

    await request(app)
      .patch(`/api/assignments/${ownAssignment._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated Own Assignment" })
      .expect(200);

    await request(app)
      .patch(`/api/assignments/${otherAssignment._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Should Not Update" })
      .expect(404);

    const unchangedAssignment = await Assignment.findById(otherAssignment._id);
    assert.equal(unchangedAssignment.title, "Other Assignment");
  });
});
