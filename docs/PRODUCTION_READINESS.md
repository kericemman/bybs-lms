# BYBS LMS Production Readiness

This checklist separates what is already in place from what must be verified in staging before public launch.

## Ready In Code

- Separate admin, mentor, student, and shared frontend workspaces
- Express API with MongoDB models and role-based route protection
- Super admin seed flow
- Public BYBS access page for live Cohort 4 onboarding and portal login
- Historical beta archive for admin review without public beta intake
- Mentor session work, resource upload, assignment creation, reminders, reviews, and reports
- Student materials, assignments, submissions, progress, bookings, support tickets, and notifications
- Resend/SMTP email delivery support
- Admin slow-request and server-error alerts
- Cloudinary upload integration with local fallback
- Frontend upload compression and backend compressed-upload enforcement
- Temporary password change flow for admin, mentor, and student accounts

## Must Verify In Staging

- Real login for super admin, admin, mentor, and student accounts
- First-login password change after temporary credentials are emailed
- Cohort 4 onboarding flow through cohorts, mentees, mentors, modules, sessions, announcements, and login emails
- Forgot/reset password flow for mentor and mentee accounts
- Cloudinary uploads for images, PDFs, docs, slides, CSV import, and student submission files
- Announcement emails render logo and inline content images from public URLs
- Student support ticket lifecycle from student reply to admin resolution
- Mentor session-work upload creates assignment/resources and notifies students
- Mentor session reminder job sends the 48-hour preparation reminder once per session
- Admin alert emails for slow requests and server errors
- Mobile navigation and form responsiveness across all three portals

## Beta Record Cleanup

Beta testing data should be cleared before live Cohort 4 onboarding. Run a dry run first:

```bash
npm --workspace backend run cleanup:beta
```

Then delete beta application and beta feedback records:

```bash
npm --workspace backend run cleanup:beta -- --confirm
```

Only if beta-created tester accounts should also be removed, run:

```bash
npm --workspace backend run cleanup:beta -- --confirm --delete-beta-created-users
```

The user cleanup only targets accounts linked from beta applications where the beta flow created the account. Existing users linked to beta applications are not included in that user cleanup.

## Full Program Archive And Reset

To clear the old program data before onboarding Cohort 4, run a dry run first:

```bash
npm --workspace backend run cleanup:program
```

Then archive the old records into `backend/archives/` and delete them from MongoDB:

```bash
npm --workspace backend run cleanup:program -- --confirm=ARCHIVE_AND_RESET_PROGRAM_DATA
```

This clears mentors, mentees, cohorts, modules, sessions, resources, assignments, submissions, bookings, reports, reminders, certificates, discussions, support tickets, beta records, mentor availability, and mentor/mentee notifications. Admin, admin manager, and super admin users are preserved.

System logs are preserved by default. To archive and clear system logs too:

```bash
npm --workspace backend run cleanup:program -- --confirm=ARCHIVE_AND_RESET_PROGRAM_DATA --include-system-logs
```

## Required Production Environment

```txt
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=use-a-long-random-secret-at-least-32-characters
CLIENT_ADMIN_URL=https://admin.lms.buildyourbestself.org
CLIENT_MENTOR_URL=https://mentor.lms.buildyourbestself.org
CLIENT_STUDENT_URL=https://lms.buildyourbestself.org
PUBLIC_API_URL=https://api.lms.buildyourbestself.org
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=bybs-lms/uploads
REQUIRE_COMPRESSED_UPLOADS=true
RESEND_API_KEY=...
EMAIL_FROM=BYBS LMS <verified@your-domain.com>
EMAIL_LOGO_URL=https://admin.lms.buildyourbestself.org/assets/Logo1.png
ADMIN_ALERTS_ENABLED=true
ADMIN_ALERT_EMAILS=admin@your-domain.com
SESSION_REMINDER_JOB_ENABLED=true
SESSION_REMINDER_INTERVAL_MS=3600000
SESSION_REMINDER_LEAD_HOURS=48
SESSION_REMINDER_WINDOW_MINUTES=90
SEED_SUPER_ADMIN_ON_START=false
```

## Launch Blockers

- Do not launch without a verified production `EMAIL_FROM` domain.
- Do not launch without database backups.
- Do not launch while using local `/uploads` as permanent storage.
- Do not launch with the example super-admin password.
- Do not launch unless `/health` and `/ready` are monitored.

## Recommended Next Hardening

- Replace temporary-password emails with single-use invite links.
- Add admin two-factor authentication.
- Move rate limiting to Redis if the API runs on multiple servers.
- Add audit log coverage for password changes, login failures, role changes, exports, and scoring.
- Add more automated tests around mentor/student data boundaries and support ticket workflows.
