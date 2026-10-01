import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, beforeEach, describe, test } from "node:test";
import { gzipSync } from "node:zlib";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "memory";
process.env.SEED_SUPER_ADMIN_ON_START = "false";
process.env.REQUIRE_COMPRESSED_UPLOADS = "true";
process.env.RESEND_API_KEY = "";
process.env.JWT_SECRET = "test-secret-with-more-than-32-characters";
process.env.BETA_FEATURES_ENABLED = "false";
process.env.LOG_LEVEL = "silent";
process.env.LOGIN_RATE_LIMIT_MAX = "1000";

const request = (await import("supertest")).default;
const mongoose = (await import("mongoose")).default;
const { app } = await import("../app.js");
const { connectDatabase, stopDatabase } = await import("../config/database.js");
const { Assignment } = await import("../models/Assignment.js");
const { BetaApplication } = await import("../models/BetaApplication.js");
const { Certificate } = await import("../models/Certificate.js");
const { Cohort } = await import("../models/Cohort.js");
const { Module } = await import("../models/Module.js");
const { MentorQuestion } = await import("../models/MentorQuestion.js");
const { Notification } = await import("../models/Notification.js");
const { Session } = await import("../models/Session.js");
const { Submission } = await import("../models/Submission.js");
const { SupportTicket } = await import("../models/SupportTicket.js");
const { SystemLog } = await import("../models/SystemLog.js");
const { User } = await import("../models/User.js");
const { runAssignmentDeadlineReminderJob } = await import("../services/assignmentReminderService.js");
const { notifyUserOnce } = await import("../services/portalNotificationService.js");
const { calculateStudentProgress } = await import("../services/progressService.js");
const {
  effectiveAssignmentDeadline,
  isPastAssignmentDeadline,
  normalizeAssignmentDueDateInput
} = await import("../utils/assignmentDeadlines.js");
const { changePasswordSchema, updateProfileSchema } = await import("../validators/authSchemas.js");
const { createAssignmentSchema } = await import("../validators/assignmentSchemas.js");
const { httpUrlSchema } = await import("../validators/commonSchemas.js");
const { updateMentorSessionAttendanceSchema } = await import("../validators/mentorSchemas.js");
const { notificationLinks } = await import("../utils/notificationLinks.js");

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

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function waitForSystemLog(route, expectedCount = 1, attempts = 20) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const count = await SystemLog.countDocuments({ route });
    if (count >= expectedCount) return SystemLog.findOne({ route }).sort({ createdAt: -1 });
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for audit log: ${route}`);
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
  test("assignment deadlines use the official BYBS CAT deadline moment", () => {
    assert.equal(normalizeAssignmentDueDateInput("2026-08-21").toISOString(), "2026-08-21T21:59:00.000Z");
    assert.equal(normalizeAssignmentDueDateInput("2026-08-21T23:59").toISOString(), "2026-08-21T21:59:00.000Z");
    assert.equal(effectiveAssignmentDeadline(new Date("2026-08-21T00:00:00.000Z")).toISOString(), "2026-08-21T21:59:00.000Z");
    assert.equal(isPastAssignmentDeadline("2026-08-21", new Date("2026-08-21T21:58:59.000Z")), false);
    assert.equal(isPastAssignmentDeadline("2026-08-21", new Date("2026-08-21T21:59:01.000Z")), true);

    const parsedRequest = createAssignmentSchema.parse({
      body: {
        title: "Deadline validation",
        instructions: "Validate the HTTP assignment deadline input.",
        cohort: "507f1f77bcf86cd799439011",
        dueDate: "2026-08-21",
        status: "published"
      }
    });
    assert.equal(parsedRequest.body.dueDate.toISOString(), "2026-08-21T21:59:00.000Z");
  });

  test("actionable notifications use exact role-specific destinations", () => {
    const firstId = "507f1f77bcf86cd799439011";
    const secondId = "507f191e810c19729de860ea";

    assert.equal(notificationLinks.studentAssignment(firstId), `/app/assignments?assignment=${firstId}`);
    assert.equal(notificationLinks.mentorSubmission({ module: firstId, submission: secondId }), `/reviews?module=${firstId}&submission=${secondId}`);
    assert.equal(notificationLinks.discussion("mentor", firstId), `/forum?discussion=${firstId}`);
    assert.equal(notificationLinks.discussion("student", firstId), `/app/forum?discussion=${firstId}`);
    assert.equal(notificationLinks.mentorBooking(firstId), `/bookings?booking=${firstId}`);
    assert.equal(notificationLinks.studentBooking(firstId), `/app/bookings?booking=${firstId}`);
    assert.equal(notificationLinks.mentorReport(firstId), `/reports?report=${firstId}`);
    assert.equal(notificationLinks.studentSupportTicket(firstId), `/app/support?ticket=${firstId}`);
    assert.equal(notificationLinks.adminSupportTicket(firstId), `/support?ticket=${firstId}`);
    assert.equal(notificationLinks.studentCertificate(firstId), `/app/certificates?certificate=${firstId}`);
    assert.equal(notificationLinks.adminCertificate(firstId), `/certificates?certificate=${firstId}`);
    assert.equal(notificationLinks.adminSystemLog(firstId), `/system-logs?log=${firstId}`);
    assert.equal(notificationLinks.mentorSession(firstId), `/session-work?session=${firstId}`);
    assert.equal(notificationLinks.mentorQuestion(firstId), `/questions?question=${firstId}`);
    assert.equal(notificationLinks.studentQuestion(firstId), `/app/questions?question=${firstId}`);
  });

  test("mentor questions remain private to the assigned mentor and preserve learning context", async (t) => {
    if (!requireDatabase(t)) return;

    const [mentor, unrelatedMentor, admin, adminManager] = await Promise.all([
      createUser({ name: "Assigned Mentor", email: "question.mentor@example.com", role: "mentor", password: "MentorPass123!" }),
      createUser({ name: "Other Mentor", email: "question.other@example.com", role: "mentor", password: "MentorPass123!" }),
      createUser({ name: "Question Admin", email: "question.admin@example.com", role: "admin", password: "AdminPass123!" }),
      createUser({ name: "Question Manager", email: "question.manager@example.com", role: "adminManager", password: "AdminPass123!" })
    ]);
    const cohort = await Cohort.create({
      title: "Question Cohort",
      status: "active",
      mentors: [mentor._id, unrelatedMentor._id]
    });
    const student = await createUser({
      name: "Question Mentee",
      email: "question.student@example.com",
      role: "student",
      password: "StudentPass123!",
      cohort: cohort._id,
      mentor: mentor._id
    });
    cohort.students = [student._id];
    await cohort.save();
    const module = await Module.create({
      title: "Contextual Learning",
      cohort: cohort._id,
      assignedMentor: mentor._id,
      status: "published"
    });
    const assignment = await Assignment.create({
      title: "Context Reflection",
      instructions: "Complete the contextual reflection.",
      cohort: cohort._id,
      module: module._id,
      dueDate: new Date(Date.now() + 86400000),
      createdBy: mentor._id,
      status: "published"
    });
    const [{ token: studentToken }, { token: mentorToken }, { token: unrelatedToken }, { token: adminToken }, { token: managerToken }] = await Promise.all([
      login(student.email, "StudentPass123!"),
      login(mentor.email, "MentorPass123!"),
      login(unrelatedMentor.email, "MentorPass123!"),
      login(admin.email, "AdminPass123!"),
      login(adminManager.email, "AdminPass123!")
    ]);

    const createdResponse = await request(app)
      .post("/api/student/mentor-questions")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        assignment: assignment._id.toString(),
        subject: "How should I structure this reflection?",
        message: "<p>Can you help me identify the strongest starting point?</p><script>unsafe()</script>"
      })
      .expect(201);

    const questionId = createdResponse.body.data._id;
    assert.equal(createdResponse.body.data.status, "open");
    assert.equal(createdResponse.body.data.module._id, module._id.toString());
    assert.equal(createdResponse.body.data.assignment._id, assignment._id.toString());
    assert.equal(createdResponse.body.data.mentor._id, mentor._id.toString());
    assert.doesNotMatch(createdResponse.body.data.messages[0].body, /script/i);

    const mentorNotification = await Notification.findOne({ recipient: mentor._id, type: "question" });
    assert.equal(mentorNotification.ctaUrl, `/questions?question=${questionId}`);
    assert.equal(mentorNotification.emailDeliveryStatus, "notConfigured");

    const mentorSummaryList = await request(app)
      .get("/api/mentor/mentor-questions")
      .set("Authorization", `Bearer ${mentorToken}`)
      .expect(200);
    assert.equal(mentorSummaryList.body.data.length, 1);
    assert.equal(mentorSummaryList.body.data[0].messages, undefined);
    assert.equal(mentorSummaryList.body.data[0].messageCount, 1);
    assert.match(mentorSummaryList.body.data[0].lastMessagePreview, /strongest starting point/i);

    const mentorList = await request(app)
      .get(`/api/mentor/mentor-questions?question=${questionId}`)
      .set("Authorization", `Bearer ${mentorToken}`)
      .expect(200);
    assert.equal(mentorList.body.data.length, 1);

    const unrelatedList = await request(app)
      .get(`/api/mentor/mentor-questions?question=${questionId}`)
      .set("Authorization", `Bearer ${unrelatedToken}`)
      .expect(200);
    assert.equal(unrelatedList.body.data.length, 0);

    await request(app)
      .post(`/api/mentor/mentor-questions/${questionId}/replies`)
      .set("Authorization", `Bearer ${unrelatedToken}`)
      .send({ message: "I should not be able to reply." })
      .expect(404);

    const replyResponse = await request(app)
      .post(`/api/mentor/mentor-questions/${questionId}/replies`)
      .set("Authorization", `Bearer ${mentorToken}`)
      .send({ message: "<p>Begin with one specific experience and connect it to your values.</p>" })
      .expect(201);
    assert.equal(replyResponse.body.data.status, "answered");
    assert.equal(replyResponse.body.data.messages.length, 2);

    const studentNotification = await Notification.findOne({ recipient: student._id, type: "question" });
    assert.equal(studentNotification.ctaUrl, `/app/questions?question=${questionId}`);

    await request(app)
      .patch(`/api/student/mentor-questions/${questionId}/status`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ status: "resolved" })
      .expect(200);

    await request(app)
      .post(`/api/mentor/mentor-questions/${questionId}/replies`)
      .set("Authorization", `Bearer ${mentorToken}`)
      .send({ message: "This cannot be added until the thread is reopened." })
      .expect(409);

    const adminList = await request(app)
      .get(`/api/admin/mentor-questions?question=${questionId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(adminList.body.data.length, 1);

    await request(app)
      .get(`/api/admin/mentor-questions?question=${questionId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(403);
    assert.equal(await MentorQuestion.countDocuments({ student: student._id, mentor: mentor._id }), 1);
  });

  test("notification idempotency allows only one delivery for concurrent requests", async (t) => {
    if (!requireDatabase(t)) return;

    await Notification.syncIndexes();
    const student = await createUser({
      name: "Idempotent Mentee",
      email: "idempotent.mentee@example.com",
      role: "student"
    });
    const uniqueKey = `assignment-reminder:test:${student._id}`;
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        notifyUserOnce({
          recipient: student,
          portalRole: "student",
          uniqueKey,
          notification: {
            title: "One reminder only",
            message: "This delivery must be idempotent.",
            channel: "both",
            type: "reminder",
            ctaLabel: "Open assignment",
            ctaUrl: "/app/assignments?assignment=test",
            targetRole: "student",
            readStatus: false
          }
        })
      )
    );

    assert.equal(results.filter((result) => result.created).length, 1);
    assert.equal(await Notification.countDocuments({ recipient: student._id, dedupeKey: uniqueKey }), 1);
    const notification = await Notification.findOne({ recipient: student._id, dedupeKey: uniqueKey });
    assert.equal(notification.announcementId, undefined);
    assert.equal(notification.emailDeliveryStatus, "notConfigured");
  });

  test("assignment deadline reminders send once per stage only to mentees who still need to act", async (t) => {
    if (!requireDatabase(t)) return;

    await Notification.syncIndexes();
    const admin = await createUser({
      name: "Reminder Admin",
      email: "reminder.admin@example.com",
      role: "admin"
    });
    const cohort = await Cohort.create({
      title: "Reminder Cohort",
      status: "active"
    });
    const [pendingStudent, revisionStudent, approvedStudent, inactiveStudent] = await Promise.all([
      createUser({ name: "Pending Mentee", email: "pending.reminder@example.com", role: "student", cohort: cohort._id }),
      createUser({ name: "Revision Mentee", email: "revision.reminder@example.com", role: "student", cohort: cohort._id }),
      createUser({ name: "Approved Mentee", email: "approved.reminder@example.com", role: "student", cohort: cohort._id }),
      createUser({ name: "Inactive Mentee", email: "inactive.reminder@example.com", role: "student", status: "inactive", cohort: cohort._id })
    ]);
    cohort.students = [pendingStudent._id, revisionStudent._id, approvedStudent._id, inactiveStudent._id];
    await cohort.save();

    const dueDate = new Date("2026-10-02T20:59:00.000Z");
    const assignment = await Assignment.create({
      title: "Deadline Reflection",
      instructions: "Complete the reflection before the official CAT deadline.",
      cohort: cohort._id,
      dueDate,
      createdBy: admin._id,
      status: "published"
    });
    await Submission.create([
      {
        assignment: assignment._id,
        student: revisionStudent._id,
        writtenResponse: "First attempt",
        status: "needsRevision",
        feedback: "Add a measurable action."
      },
      {
        assignment: assignment._id,
        student: approvedStudent._id,
        writtenResponse: "Approved work",
        status: "approved",
        score: 90
      }
    ]);

    const fortyEightHourRun = await runAssignmentDeadlineReminderJob({
      now: new Date(dueDate.getTime() - 47 * 60 * 60 * 1000)
    });
    assert.equal(fortyEightHourRun.sent, 2);
    assert.equal(fortyEightHourRun.candidates, 2);

    const duplicateRun = await runAssignmentDeadlineReminderJob({
      now: new Date(dueDate.getTime() - 47 * 60 * 60 * 1000)
    });
    assert.equal(duplicateRun.sent, 0);
    assert.equal(duplicateRun.skipped, 2);

    await Submission.create({
      assignment: assignment._id,
      student: pendingStudent._id,
      writtenResponse: "Submitted after the first reminder",
      status: "submitted"
    });

    const twentyFourHourRun = await runAssignmentDeadlineReminderJob({
      now: new Date(dueDate.getTime() - 23 * 60 * 60 * 1000)
    });
    assert.equal(twentyFourHourRun.sent, 1);
    assert.equal(twentyFourHourRun.candidates, 1);

    const deadlineDayRun = await runAssignmentDeadlineReminderJob({
      now: new Date("2026-10-02T06:00:00.000Z")
    });
    assert.equal(deadlineDayRun.sent, 1);
    assert.equal(deadlineDayRun.candidates, 1);

    const notifications = await Notification.find({
      targetType: "assignment",
      targetLabel: assignment.title,
      type: "reminder"
    }).sort({ createdAt: 1 });
    assert.equal(notifications.length, 4);
    assert.equal(notifications.filter((notification) => String(notification.recipient) === String(revisionStudent._id)).length, 3);
    assert.equal(notifications.filter((notification) => String(notification.recipient) === String(pendingStudent._id)).length, 1);
    assert.equal(notifications.some((notification) => String(notification.recipient) === String(approvedStudent._id)), false);
    assert.equal(notifications.some((notification) => String(notification.recipient) === String(inactiveStudent._id)), false);
    assert.equal(notifications.every((notification) => notification.ctaUrl === `/app/assignments?assignment=${assignment._id}`), true);
    assert.equal(notifications.every((notification) => notification.announcementId === undefined), true);
    assert.equal(notifications.every((notification) => notification.emailDeliveryStatus === "notConfigured"), true);
    assert.match(notifications.at(-1).title, /due today/i);
  });

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

  test("mentor attendance accepts a cohort roster of up to 1000 mentees", () => {
    const sessionId = new mongoose.Types.ObjectId().toString();
    const studentId = new mongoose.Types.ObjectId().toString();
    const record = { student: studentId, status: "present" };

    assert.doesNotThrow(() => updateMentorSessionAttendanceSchema.parse({
      params: { id: sessionId },
      body: { records: Array.from({ length: 1000 }, () => record) }
    }));
    assert.throws(() => updateMentorSessionAttendanceSchema.parse({
      params: { id: sessionId },
      body: { records: Array.from({ length: 1001 }, () => record) }
    }));
  });

  test("authentication failures return clear messages without exposing account details", async (t) => {
    if (!requireDatabase(t)) return;
    await createUser({
      email: "login.message@example.com",
      role: "student",
      password: "CorrectPass123!"
    });

    const invalidLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "login.message@example.com", password: "WrongPass123!" })
      .expect(401);
    assert.equal(invalidLogin.body.message, "The email or password you entered is incorrect.");

    const missingAccount = await request(app)
      .post("/api/auth/login")
      .send({ email: "missing@example.com", password: "WrongPass123!" })
      .expect(401);
    assert.equal(missingAccount.body.message, invalidLogin.body.message);

    const expiredSession = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-or-expired-token")
      .expect(401);
    assert.equal(expiredSession.body.message, "Invalid or expired session");
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
    assert.ok(changeResponse.body.token);

    await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginResponse.token}`)
      .expect(401);

    await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${changeResponse.body.token}`)
      .expect(200);

    const nextLoginResponse = await login("student@example.com", "NewSecurePass123!");
    assert.equal(nextLoginResponse.user.passwordResetRequired, false);
  });

  test("mentors and mentees can reset passwords with a valid one-time token", async (t) => {
    if (!requireDatabase(t)) return;
    const token = crypto.randomBytes(32).toString("hex");
    const user = await createUser({
      email: "reset.student@example.com",
      role: "student",
      password: "TempPass123!",
      passwordResetRequired: true
    });
    user.passwordResetTokenHash = hashResetToken(token);
    user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    user.passwordResetRequestedAt = new Date();
    await user.save();

    await request(app)
      .post("/api/auth/reset-password")
      .send({
        token,
        newPassword: "NewSecurePass123!"
      })
      .expect(200);

    const loginResponse = await login("reset.student@example.com", "NewSecurePass123!");
    assert.equal(loginResponse.user.passwordResetRequired, false);

    const updatedUser = await User.findById(user._id).select("+passwordResetTokenHash +passwordResetExpiresAt");
    assert.equal(updatedUser.passwordResetTokenHash, undefined);
    assert.equal(updatedUser.passwordResetExpiresAt, undefined);

    await request(app)
      .post("/api/auth/reset-password")
      .send({
        token,
        newPassword: "AnotherSecurePass123!"
      })
      .expect(400);
  });

  test("beta intake and acceptance are closed for production onboarding", async (t) => {
    if (!requireDatabase(t)) return;
    await createUser({
      email: "admin@example.com",
      role: "superAdmin",
      password: "AdminPass123!"
    });
    const { token } = await login("admin@example.com", "AdminPass123!");

    await request(app)
      .post("/api/public/beta-applications")
      .send({
        applicantType: "student",
        name: "Closed Beta Student",
        email: "closed.beta.student@example.com",
        phone: "+211912345678",
        motivation: "I want to join the old beta testing flow.",
        consent: true
      })
      .expect(410);

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
      .expect(410);

    assert.match(response.body.message, /closed/i);

    const tester = await User.findOne({ email: "beta.student@example.com" });
    assert.equal(tester, null);
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

  test("external URLs reject executable and embedded-data schemes", () => {
    assert.equal(httpUrlSchema.safeParse("https://buildyourbestself.org/resource").success, true);
    assert.equal(httpUrlSchema.safeParse("http://localhost:5050/uploads/file.pdf").success, true);
    assert.equal(httpUrlSchema.safeParse("javascript:alert(1)").success, false);
    assert.equal(httpUrlSchema.safeParse("data:text/html,<script>alert(1)</script>").success, false);
  });

  test("compressed profile uploads cannot expand beyond the server limit", async (t) => {
    if (!requireDatabase(t)) return;
    await createUser({
      email: "upload.admin@example.com",
      role: "superAdmin",
      password: "AdminPass123!"
    });
    const { token } = await login("upload.admin@example.com", "AdminPass123!");
    const compressedPayload = gzipSync(Buffer.alloc(6 * 1024 * 1024));
    const manifest = JSON.stringify([{
      fieldName: "file",
      originalName: "profile.png",
      originalType: "image/png",
      originalSize: 1024 * 1024
    }]);

    const response = await request(app)
      .post("/api/auth/profile-image")
      .set("Authorization", `Bearer ${token}`)
      .field("__bybsUploadCompression", "gzip-v1")
      .field("__bybsUploadManifest", manifest)
      .attach("file", compressedPayload, {
        filename: "profile.png.gz",
        contentType: "application/gzip"
      })
      .expect(400);

    assert.match(response.body.message, /allowed size/i);
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

  test("mentees only access their cohort assignments and can submit supported content", async (t) => {
    if (!requireDatabase(t)) return;

    const admin = await createUser({
      name: "Program Admin",
      email: "program.admin@example.com",
      role: "admin",
      password: "AdminPass123!"
    });
    const [studentCohort, otherCohort] = await Cohort.create([
      { title: "Mentee Cohort", status: "active" },
      { title: "Other Cohort", status: "active" }
    ]);
    const student = await createUser({
      name: "Mentee One",
      email: "mentee.one@example.com",
      role: "student",
      password: "MenteePass123!",
      cohort: studentCohort._id
    });
    studentCohort.students = [student._id];
    await studentCohort.save();

    const visibleAssignment = await Assignment.create({
      title: "Visible Reflection",
      instructions: "Write a clear reflection and submit it before the deadline.",
      cohort: studentCohort._id,
      dueDate: new Date(Date.now() + 86400000),
      createdBy: admin._id,
      status: "published"
    });
    const hiddenAssignment = await Assignment.create({
      title: "Other Cohort Reflection",
      instructions: "This assignment must not be visible outside its cohort.",
      cohort: otherCohort._id,
      dueDate: new Date(Date.now() + 86400000),
      createdBy: admin._id,
      status: "published"
    });
    const { token } = await login("mentee.one@example.com", "MenteePass123!");

    const listResponse = await request(app)
      .get("/api/student/assignments?limit=100")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.deepEqual(listResponse.body.data.map((assignment) => assignment.title), ["Visible Reflection"]);

    await request(app)
      .post(`/api/student/assignments/${visibleAssignment._id}/submission`)
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(400);

    const submissionResponse = await request(app)
      .post(`/api/student/assignments/${visibleAssignment._id}/submission`)
      .set("Authorization", `Bearer ${token}`)
      .send({ writtenResponse: "<p>This is my completed BYBS reflection.</p>" })
      .expect(201);

    assert.equal(submissionResponse.body.data.status, "submitted");
    assert.equal(submissionResponse.body.data.attemptNumber, 1);
    assert.match(submissionResponse.body.data.writtenResponse, /completed BYBS reflection/);

    const reviewedFirstAttempt = await Submission.findOne({
      assignment: visibleAssignment._id,
      student: student._id
    });
    reviewedFirstAttempt.status = "approved";
    reviewedFirstAttempt.score = 91;
    reviewedFirstAttempt.feedback = "<p>Strong first attempt.</p>";
    reviewedFirstAttempt.reviewedBy = admin._id;
    reviewedFirstAttempt.reviewedAt = new Date();
    await reviewedFirstAttempt.save();

    const resubmissionResponse = await request(app)
      .post(`/api/student/assignments/${visibleAssignment._id}/submission`)
      .set("Authorization", `Bearer ${token}`)
      .send({ writtenResponse: "<p>This is my revised BYBS reflection.</p>" })
      .expect(200);

    assert.equal(resubmissionResponse.body.data.status, "resubmitted");
    assert.equal(resubmissionResponse.body.data.attemptNumber, 2);
    assert.equal(resubmissionResponse.body.data.history.length, 1);
    assert.equal(resubmissionResponse.body.data.history[0].status, "approved");
    assert.equal(resubmissionResponse.body.data.history[0].score, 91);
    assert.match(resubmissionResponse.body.data.history[0].feedback, /Strong first attempt/);
    assert.equal(resubmissionResponse.body.data.score, undefined);
    assert.equal(resubmissionResponse.body.data.feedback, undefined);

    await request(app)
      .post(`/api/student/assignments/${hiddenAssignment._id}/submission`)
      .set("Authorization", `Bearer ${token}`)
      .send({ writtenResponse: "This must remain outside my cohort." })
      .expect(404);

    await request(app)
      .get("/api/mentor/submissions")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  test("mentee dashboard uses authoritative progress and prioritises published revision feedback", async (t) => {
    if (!requireDatabase(t)) return;

    const mentor = await createUser({
      name: "Dashboard Mentor",
      email: "dashboard.mentor@example.com",
      role: "mentor"
    });
    const cohort = await Cohort.create({
      title: "Dashboard Cohort",
      status: "active",
      startDate: new Date(Date.now() - 7 * 86400000),
      endDate: new Date(Date.now() + 30 * 86400000),
      mentors: [mentor._id]
    });
    const student = await createUser({
      name: "Dashboard Mentee",
      email: "dashboard.mentee@example.com",
      role: "student",
      cohort: cohort._id,
      mentor: mentor._id
    });
    cohort.students = [student._id];
    await cohort.save();

    const module = await Module.create({
      title: "Purpose and Direction",
      cohort: cohort._id,
      assignedMentor: mentor._id,
      startDate: new Date(Date.now() - 2 * 86400000),
      endDate: new Date(Date.now() + 7 * 86400000),
      status: "published"
    });
    const assignments = await Assignment.create([
      {
        title: "Purpose Reflection",
        instructions: "Write your reflection.",
        cohort: cohort._id,
        module: module._id,
        dueDate: new Date(Date.now() + 4 * 86400000),
        createdBy: mentor._id,
        status: "published",
        maxScore: 100
      },
      {
        title: "Direction Plan",
        instructions: "Revise your direction plan.",
        cohort: cohort._id,
        module: module._id,
        dueDate: new Date(Date.now() + 5 * 86400000),
        createdBy: mentor._id,
        status: "published",
        maxScore: 100
      },
      {
        title: "Weekly Commitment",
        instructions: "Submit your weekly commitment.",
        cohort: cohort._id,
        module: module._id,
        dueDate: new Date(Date.now() + 2 * 86400000),
        createdBy: mentor._id,
        status: "published",
        maxScore: 100
      }
    ]);
    await Submission.create([
      {
        assignment: assignments[0]._id,
        student: student._id,
        writtenResponse: "Completed reflection",
        submittedAt: new Date(Date.now() - 2 * 86400000),
        status: "approved",
        score: 84,
        feedback: "<p>Clear and thoughtful reflection.</p>",
        reviewedBy: mentor._id,
        reviewedAt: new Date(Date.now() - 86400000)
      },
      {
        assignment: assignments[1]._id,
        student: student._id,
        writtenResponse: "Direction plan",
        submittedAt: new Date(Date.now() - 86400000),
        status: "needsRevision",
        feedback: "<p>Add one measurable action and a completion date.</p>",
        reviewedBy: mentor._id,
        reviewedAt: new Date()
      }
    ]);
    await Session.create([
      {
        title: "Purpose Workshop",
        cohort: cohort._id,
        module: module._id,
        startsAt: new Date(Date.now() - 86400000),
        status: "completed",
        attendance: [{ student: student._id, status: "present", markedBy: mentor._id }]
      },
      {
        title: "Direction Workshop",
        cohort: cohort._id,
        module: module._id,
        startsAt: new Date(Date.now() + 86400000),
        status: "scheduled"
      }
    ]);

    const expectedProgress = await calculateStudentProgress(student);
    const { token } = await login("dashboard.mentee@example.com", "TempPass123!");
    const response = await request(app)
      .get("/api/student/dashboard")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(response.body.data.user.cohort.title, "Dashboard Cohort");
    assert.equal(response.body.data.summary.progress, expectedProgress.progress);
    assert.equal(response.body.data.summary.assignmentCompletionPercentage, expectedProgress.assignmentCompletionPercentage);
    assert.equal(response.body.data.summary.attendancePercentage, expectedProgress.attendancePercentage);
    assert.equal(response.body.data.currentModule.title, "Purpose and Direction");
    assert.equal(response.body.data.currentModule.assignmentSummary.total, 3);
    assert.equal(response.body.data.currentModule.assignmentSummary.submitted, 2);
    assert.equal(response.body.data.nextAction.type, "revision");
    assert.match(response.body.data.nextAction.title, /Direction Plan/);
    assert.equal(response.body.data.upcoming.nearestDeadline.title, "Weekly Commitment");
    assert.equal(response.body.data.upcoming.nextSession.title, "Direction Workshop");
    assert.equal(response.body.data.recentFeedback.status, "needsRevision");
    assert.match(response.body.data.recentFeedback.feedbackPreview, /measurable action/);
  });

  test("mentors can grade only submissions from their assigned modules", async (t) => {
    if (!requireDatabase(t)) return;

    const mentorA = await createUser({
      name: "Assigned Mentor",
      email: "assigned.mentor@example.com",
      role: "mentor",
      password: "MentorPass123!"
    });
    const mentorB = await createUser({
      name: "Other Mentor",
      email: "other.mentor@example.com",
      role: "mentor",
      password: "MentorPass123!"
    });
    const cohort = await Cohort.create({
      title: "Review Scope Cohort",
      status: "active",
      mentors: [mentorA._id, mentorB._id]
    });
    mentorA.cohort = cohort._id;
    mentorB.cohort = cohort._id;
    await Promise.all([mentorA.save(), mentorB.save()]);

    const student = await createUser({
      name: "Review Mentee",
      email: "review.mentee@example.com",
      role: "student",
      cohort: cohort._id,
      mentor: mentorA._id
    });
    cohort.students = [student._id];
    await cohort.save();

    const [assignedModule, otherModule] = await Module.create([
      {
        title: "Assigned Module",
        cohort: cohort._id,
        assignedMentor: mentorA._id,
        status: "published"
      },
      {
        title: "Other Mentor Module",
        cohort: cohort._id,
        assignedMentor: mentorB._id,
        status: "published"
      }
    ]);
    const [assignedWork, otherWork] = await Assignment.create([
      {
        title: "Assigned Work",
        instructions: "Complete work for the assigned mentor.",
        cohort: cohort._id,
        module: assignedModule._id,
        dueDate: new Date(Date.now() + 86400000),
        createdBy: mentorA._id,
        status: "published",
        maxScore: 100
      },
      {
        title: "Other Mentor Work",
        instructions: "Complete work for the other mentor.",
        cohort: cohort._id,
        module: otherModule._id,
        dueDate: new Date(Date.now() + 86400000),
        createdBy: mentorB._id,
        status: "published",
        maxScore: 100
      }
    ]);
    const [assignedSubmission, otherSubmission] = await Submission.create([
      {
        assignment: assignedWork._id,
        student: student._id,
        writtenResponse: "Assigned module response",
        status: "submitted"
      },
      {
        assignment: otherWork._id,
        student: student._id,
        writtenResponse: "Other module response",
        status: "submitted"
      }
    ]);
    const { token } = await login("assigned.mentor@example.com", "MentorPass123!");
    const { token: studentToken } = await login("review.mentee@example.com", "TempPass123!");
    const notificationCountBeforeDraft = await Notification.countDocuments({ recipient: student._id });

    const draftResponse = await request(app)
      .patch(`/api/mentor/submissions/${assignedSubmission._id}/review-draft`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "approved",
        score: 84,
        feedback: "<p>Private grading notes that are not ready yet.</p>",
        feedbackFileUrl: "https://example.com/private-feedback.pdf"
      })
      .expect(200);

    assert.equal(draftResponse.body.data.status, "submitted");
    assert.equal(draftResponse.body.data.score, undefined);
    assert.equal(draftResponse.body.data.reviewDraft.status, "approved");
    assert.equal(draftResponse.body.data.reviewDraft.score, 84);

    const storedDraft = await Submission.findById(assignedSubmission._id).select("+reviewDraft");
    assert.equal(storedDraft.status, "submitted");
    assert.equal(storedDraft.score, undefined);
    assert.equal(storedDraft.reviewDraft.score, 84);
    assert.equal(await Notification.countDocuments({ recipient: student._id }), notificationCountBeforeDraft);

    const studentAssignmentsResponse = await request(app)
      .get("/api/student/assignments?limit=100")
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(200);
    const studentSubmission = studentAssignmentsResponse.body.data.find((assignment) => assignment._id === String(assignedWork._id)).submission;
    assert.equal(Object.hasOwn(studentSubmission, "reviewDraft"), false);

    const draftQueueResponse = await request(app)
      .get(`/api/mentor/submissions?module=${assignedModule._id}&status=draftSaved&sort=oldest&limit=25`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    assert.equal(draftQueueResponse.body.data.length, 1);
    assert.equal(draftQueueResponse.body.data[0].reviewDraft.score, 84);
    assert.equal(draftQueueResponse.body.meta.filters.students[0].name, "Review Mentee");
    assert.equal(draftQueueResponse.body.meta.filters.assignments[0].title, "Assigned Work");

    await request(app)
      .delete(`/api/mentor/submissions/${assignedSubmission._id}/review-draft`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const discardedDraft = await Submission.findById(assignedSubmission._id).select("+reviewDraft");
    assert.equal(discardedDraft.reviewDraft, undefined);

    await request(app)
      .patch(`/api/mentor/submissions/${assignedSubmission._id}/review-draft`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "approved",
        score: 86,
        feedback: "<p>Final draft ready to publish.</p>"
      })
      .expect(200);

    const approvedResponse = await request(app)
      .patch(`/api/mentor/submissions/${assignedSubmission._id}/review`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "approved",
        score: 86,
        feedback: "<p>Clear reflection with relevant examples.</p>",
        feedbackFileUrl: "https://example.com/published-feedback.pdf"
      })
      .expect(200);

    assert.equal(approvedResponse.body.data.status, "approved");
    assert.equal(approvedResponse.body.data.score, 86);
    assert.equal(approvedResponse.body.data.feedbackFileUrl, "https://example.com/published-feedback.pdf");
    assert.equal(approvedResponse.body.data.reviewDraft, undefined);
    assert.equal(String(approvedResponse.body.data.reviewedBy._id), String(mentorA._id));
    assert.equal(await Notification.countDocuments({ recipient: student._id }), notificationCountBeforeDraft + 1);
    const reviewNotification = await Notification.findOne({ recipient: student._id }).sort({ createdAt: -1 });
    assert.equal(reviewNotification.ctaUrl, `/app/assignments?assignment=${assignedWork._id}`);

    const exactQueueResponse = await request(app)
      .get(`/api/mentor/submissions?module=${assignedModule._id}&submission=${assignedSubmission._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    assert.equal(exactQueueResponse.body.data.length, 1);
    assert.equal(exactQueueResponse.body.data[0]._id, String(assignedSubmission._id));

    const outOfScopeQueueResponse = await request(app)
      .get(`/api/mentor/submissions?module=${assignedModule._id}&submission=${otherSubmission._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    assert.equal(outOfScopeQueueResponse.body.data.length, 0);

    await request(app)
      .patch(`/api/mentor/submissions/${otherSubmission._id}/review-draft`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "reviewed", feedback: "Private notes must not cross module scope." })
      .expect(403);

    await request(app)
      .patch(`/api/mentor/submissions/${otherSubmission._id}/review`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "approved", score: 70, feedback: "Should not be accepted." })
      .expect(403);

    const unchangedSubmission = await Submission.findById(otherSubmission._id);
    assert.equal(unchangedSubmission.status, "submitted");
    assert.equal(unchangedSubmission.score, undefined);
  });

  test("progress attendance is calculated from individual session records", async (t) => {
    if (!requireDatabase(t)) return;

    await createUser({
      name: "Attendance Admin",
      email: "attendance.admin@example.com",
      role: "admin",
      password: "AdminPass123!"
    });
    const marker = await createUser({
      name: "Attendance Mentor",
      email: "attendance.mentor@example.com",
      role: "mentor"
    });
    const cohort = await Cohort.create({
      title: "Attendance Cohort",
      status: "active",
      mentors: [marker._id]
    });
    const student = await createUser({
      name: "Attendance Mentee",
      email: "attendance.mentee@example.com",
      role: "student",
      cohort: cohort._id,
      mentor: marker._id
    });
    cohort.students = [student._id];
    await cohort.save();

    const sessionTime = new Date(Date.now() - 86400000);
    const sessions = await Session.create([
      {
        title: "Present Session",
        cohort: cohort._id,
        startsAt: sessionTime,
        status: "completed",
        attendance: [{ student: student._id, status: "present", markedBy: marker._id }]
      },
      {
        title: "Late Session",
        cohort: cohort._id,
        startsAt: sessionTime,
        status: "completed",
        attendance: [{ student: student._id, status: "late", markedBy: marker._id }]
      },
      {
        title: "Absent Session",
        cohort: cohort._id,
        startsAt: sessionTime,
        status: "completed",
        attendance: [{ student: student._id, status: "absent", markedBy: marker._id }]
      },
      {
        title: "Unmarked Session",
        cohort: cohort._id,
        startsAt: sessionTime,
        status: "completed"
      },
      {
        title: "Future Session",
        cohort: cohort._id,
        startsAt: new Date(Date.now() + 86400000),
        status: "scheduled"
      },
      {
        title: "Cancelled Session",
        cohort: cohort._id,
        startsAt: sessionTime,
        status: "cancelled"
      }
    ]);

    const progress = await calculateStudentProgress(student);

    assert.equal(progress.sessionsHeld, 4);
    assert.equal(progress.attendanceMarked, 3);
    assert.equal(progress.attendanceNotMarked, 1);
    assert.equal(progress.attendanceCoveragePercentage, 75);
    assert.equal(progress.presentCount, 1);
    assert.equal(progress.lateAttendanceCount, 1);
    assert.equal(progress.absentCount, 1);
    assert.equal(progress.attended, 2);
    assert.equal(progress.attendancePercentage, 44);
    assert.equal(progress.attendanceHistory.length, 4);
    assert.equal(progress.attendanceHistory.find((record) => record.title === "Unmarked Session").attendanceStatus, "notMarked");

    const { token: adminToken } = await login("attendance.admin@example.com", "AdminPass123!");
    const unmarkedSession = sessions.find((session) => session.title === "Unmarked Session");
    const rosterResponse = await request(app)
      .get(`/api/admin/sessions/${unmarkedSession._id}/attendance`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    assert.equal(rosterResponse.body.data.session.attendanceSummary.total, 1);
    assert.equal(rosterResponse.body.data.session.attendanceSummary.pending, 1);
    assert.equal(rosterResponse.body.data.roster[0].status, "notMarked");

    const correctionResponse = await request(app)
      .patch(`/api/admin/sessions/${unmarkedSession._id}/attendance`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reason: "Corrected from the signed attendance sheet.",
        markCompleted: true,
        expectedUpdatedAt: rosterResponse.body.data.session.updatedAt,
        records: [{ student: student._id, status: "present" }]
      })
      .expect(200);

    assert.equal(correctionResponse.body.meta.changedCount, 1);
    assert.equal(correctionResponse.body.data.session.attendanceSummary.marked, 1);
    assert.equal(correctionResponse.body.data.roster[0].status, "present");
    assert.equal(correctionResponse.body.data.audit[0].previousStatus, "notMarked");
    assert.equal(correctionResponse.body.data.audit[0].newStatus, "present");
    assert.equal(correctionResponse.body.data.audit[0].changedBy.name, "Attendance Admin");

    const auditLog = await waitForSystemLog(`/api/admin/sessions/${unmarkedSession._id}/attendance`);
    assert.equal(String(auditLog.user), String(correctionResponse.body.data.audit[0].changedBy._id));
    assert.equal(auditLog.statusCode, 200);

    await request(app)
      .patch(`/api/admin/sessions/${unmarkedSession._id}/attendance`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reason: "This stale correction must not overwrite newer attendance.",
        expectedUpdatedAt: rosterResponse.body.data.session.updatedAt,
        records: [{ student: student._id, status: "absent" }]
      })
      .expect(409);
    await waitForSystemLog(`/api/admin/sessions/${unmarkedSession._id}/attendance`, 2);

    const correctedProgress = await calculateStudentProgress(student);
    assert.equal(correctedProgress.attendanceMarked, 4);
    assert.equal(correctedProgress.attendanceNotMarked, 0);
    assert.equal(correctedProgress.attendanceCoveragePercentage, 100);
    assert.equal(correctedProgress.presentCount, 2);
    assert.equal(correctedProgress.attendancePercentage, 69);
  });

  test("admin learner overview consolidates objective progress without leaking private questions", async (t) => {
    if (!requireDatabase(t)) return;

    const [admin, adminManager, mentor] = await Promise.all([
      createUser({ name: "Overview Admin", email: "overview.admin@example.com", role: "admin", password: "AdminPass123!" }),
      createUser({ name: "Overview Manager", email: "overview.manager@example.com", role: "adminManager", password: "AdminPass123!" }),
      createUser({ name: "Overview Mentor", email: "overview.mentor@example.com", role: "mentor", password: "MentorPass123!" })
    ]);
    const cohort = await Cohort.create({
      title: "Overview Cohort",
      status: "active",
      mentors: [mentor._id]
    });
    const [onTrackStudent, attentionStudent] = await Promise.all([
      createUser({
        name: "On Track Mentee",
        email: "overview.track@example.com",
        role: "student",
        password: "StudentPass123!",
        cohort: cohort._id,
        mentor: mentor._id
      }),
      createUser({
        name: "Attention Mentee",
        email: "overview.attention@example.com",
        role: "student",
        password: "StudentPass123!",
        cohort: cohort._id,
        mentor: mentor._id
      })
    ]);
    cohort.students = [onTrackStudent._id, attentionStudent._id];
    await cohort.save();

    const module = await Module.create({
      title: "Overview Module",
      cohort: cohort._id,
      assignedMentor: mentor._id,
      status: "published"
    });
    const assignment = await Assignment.create({
      title: "Overview Assignment",
      instructions: "Complete the overview assignment.",
      cohort: cohort._id,
      module: module._id,
      dueDate: new Date(Date.now() + 86400000),
      maxScore: 100,
      createdBy: admin._id,
      status: "published"
    });
    await Promise.all([
      Submission.create({
        assignment: assignment._id,
        student: onTrackStudent._id,
        writtenResponse: "Completed work",
        submittedAt: new Date(),
        score: 84,
        status: "approved",
        reviewedBy: mentor._id,
        reviewedAt: new Date()
      }),
      Session.create({
        title: "Overview Session",
        cohort: cohort._id,
        module: module._id,
        startsAt: new Date(Date.now() - 86400000),
        status: "completed",
        attendance: [{ student: onTrackStudent._id, status: "present", markedBy: mentor._id }]
      }),
      SupportTicket.create({
        student: onTrackStudent._id,
        category: "assignment",
        subject: "Cannot open assignment guidance",
        message: "The guidance link is unavailable.",
        status: "open"
      }),
      MentorQuestion.create({
        student: onTrackStudent._id,
        mentor: mentor._id,
        cohort: cohort._id,
        module: module._id,
        assignment: assignment._id,
        subject: "Private assignment question",
        messages: [{ sender: onTrackStudent._id, senderRole: "student", body: "Private question body" }],
        messageCount: 1,
        lastMessagePreview: "Private question body",
        status: "open"
      }),
      Certificate.create({
        student: onTrackStudent._id,
        cohort: cohort._id,
        mentorApprovedBy: mentor._id,
        status: "mentorApproved"
      })
    ]);

    const [{ token: adminToken }, { token: managerToken }, { token: mentorToken }] = await Promise.all([
      login(admin.email, "AdminPass123!"),
      login(adminManager.email, "AdminPass123!"),
      login(mentor.email, "MentorPass123!")
    ]);

    const overviewResponse = await request(app)
      .get(`/api/admin/learner-overview?cohort=${cohort._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    assert.equal(overviewResponse.body.summary.learners, 2);
    assert.equal(overviewResponse.body.summary.graduationReady, 1);
    assert.equal(overviewResponse.body.summary.needsAttention, 1);
    assert.equal(overviewResponse.body.data[0].student.name, "On Track Mentee");
    assert.equal(overviewResponse.body.data[0].student.mentor.name, "Overview Mentor");
    assert.equal(overviewResponse.body.data[0].risk, "onTrack");
    assert.equal(overviewResponse.body.data[1].risk, "needsAttention");

    const filteredResponse = await request(app)
      .get(`/api/admin/learner-overview?cohort=${cohort._id}&risk=needsAttention`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(filteredResponse.body.data.length, 1);
    assert.equal(filteredResponse.body.data[0].student.name, "Attention Mentee");
    assert.equal(filteredResponse.body.data[0].rank, 2);

    const detailResponse = await request(app)
      .get(`/api/admin/learner-overview/${onTrackStudent._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(detailResponse.body.data.progress.graduationReady, true);
    assert.equal(detailResponse.body.data.support.unresolved, 1);
    assert.equal(detailResponse.body.data.mentorQuestions.unresolved, 1);
    assert.equal(detailResponse.body.data.mentorQuestions.canViewSubjects, true);
    assert.equal(detailResponse.body.data.mentorQuestions.recent[0].subject, "Private assignment question");
    assert.equal(detailResponse.body.data.mentorQuestions.recent[0].messages, undefined);
    assert.equal(detailResponse.body.data.certificate.status, "mentorApproved");

    const managerDetailResponse = await request(app)
      .get(`/api/admin/learner-overview/${onTrackStudent._id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    assert.equal(managerDetailResponse.body.data.mentorQuestions.unresolved, 1);
    assert.equal(managerDetailResponse.body.data.mentorQuestions.canViewSubjects, false);
    assert.deepEqual(managerDetailResponse.body.data.mentorQuestions.recent, []);

    await request(app)
      .get(`/api/admin/learner-overview?cohort=${cohort._id}`)
      .set("Authorization", `Bearer ${mentorToken}`)
      .expect(403);
  });
});
