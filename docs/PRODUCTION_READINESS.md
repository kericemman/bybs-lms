# BYBS LMS Production Readiness

This checklist separates what is already in place from what must be verified in staging before public launch.

## Ready In Code

- Separate admin, mentor, student, and shared frontend workspaces
- Express API with MongoDB models and role-based route protection
- Super admin seed flow
- Public BYBS access page and beta application form
- Admin beta queue, acceptance flow, accepted tester sections, and beta feedback review
- Mentor session work, resource upload, assignment creation, reminders, reviews, reports, and beta feedback
- Student materials, assignments, submissions, progress, bookings, support tickets, notifications, and beta feedback
- Resend/SMTP email delivery support
- Admin slow-request and server-error alerts
- Cloudinary upload integration with local fallback
- Frontend upload compression and backend compressed-upload enforcement
- Temporary password change flow for admin, mentor, and student accounts

## Must Verify In Staging

- Real login for super admin, admin, mentor, and student accounts
- First-login password change after temporary credentials are emailed
- Beta application submission from the public page
- Accepting beta applications creates/reuses tester accounts and sends email
- Cloudinary uploads for images, PDFs, docs, slides, CSV import, and student submission files
- Announcement emails render logo and inline content images from public URLs
- Student support ticket lifecycle from student reply to admin resolution
- Mentor session-work upload creates assignment/resources and notifies students
- Mentor session reminder job sends the 48-hour preparation reminder once per session
- Admin alert emails for slow requests and server errors
- Mobile navigation and form responsiveness across all three portals

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
