# BYBS LMS Feedback Implementation

## Status

Phase 0 established the safety baseline for the September 2026 learner-feedback work. Phases 1 and 2 now improve core trust, progress, communication, administration, mobile usability, and accessibility without changing or deleting existing production records.

Current implementation stage: **Phases 1 and 2 complete; Phase 3 paused for deployment assessment**. The previously implemented Phase 3A PWA files remain local and validated, but their inclusion in the production release still requires an explicit release decision.

## Completed

- Audited the admin, mentor, mentee, shared UI, and backend workspaces.
- Traced assignment creation, submission, grading, attendance, progress, notification, authentication, and upload flows.
- Confirmed that the current architecture can be extended without a rebuild.
- Confirmed that Phase 1 can use backward-compatible schema additions rather than destructive migrations.
- Added regression coverage for:
  - cohort-isolated assignment visibility;
  - learner submission validation and creation;
  - learner denial from mentor routes;
  - mentor module-scoped grading;
  - attendance calculations from individual session records.
- Ran production builds for all three portals.
- Ran the database-backed backend test suite with email delivery disabled.
- Added direct links from assignment notifications, reminders, search, and the dashboard to the relevant assignment.
- Added assignment filters, clear human-readable states, assigned and due dates, submission timestamps, exact scores, percentages, grader details, grading dates, and rich mentor feedback.
- Added locally persisted written-response, link, and upload metadata drafts with retry-friendly upload and submission errors.
- Added a persistent submission receipt that confirms the attempt, time, status, file, link, and written response received.
- Added backward-compatible resubmission history so a new attempt no longer erases the previous response, score, feedback, reviewer, or timestamps.
- Added private mentor review drafts that are excluded from ordinary queries and never alter learner-visible scores, progress, status, or notifications before publication.
- Added explicit Publish feedback, Request revision, and Publish grade outcomes, with score enforcement and required written feedback.
- Added module-scoped queue filters for learner, assignment, submitted date, review state, saved drafts, and oldest/newest ordering.
- Added review pagination, turnaround indicators, private-draft timestamps, and optional compressed feedback attachments.
- Corrected attendance percentages to use every non-cancelled session that has started, so an unmarked register can no longer inflate a learner's result.
- Added explicit not-marked totals, roster coverage, and learner-facing session attendance history.
- Added an admin attendance workspace with cohort roster editing, correction reasons, actor attribution, and before/after audit history.
- Updated mentor attendance rows and dashboard totals to recognise authoritative records regardless of whether a mentor or admin entered them.
- Raised mentor attendance rosters to the 1,000-user target and added stale-save conflict protection so one open roster cannot silently overwrite a newer correction.
- Added startup session validation before protected portal content mounts.
- Added automatic expired-session cleanup, a clear sign-in explanation, and restoration of the full requested path, query, and hash after authentication.
- Added safe, non-enumerating login errors, explicit submission loading states, and authenticated-user guards on login and password-reset routes.
- Reorganised mentee navigation around Dashboard, Learn, Assignments, Progress, Notifications, and Profile, while retaining secondary routes under More.
- Added reusable keyboard-safe dialog behavior with Escape handling, focus trapping, focus restoration, and background scroll locking.
- Added a skip link, one top-level page heading, semantic progress bars, labelled keyboard-scrollable tables, and accessible rich-text toolbar states.
- Added explicit names to hidden upload controls, attendance selectors, admin filters, and dynamically opened forum reply fields.
- Increased mobile touch targets and mobile form text sizing to prevent cramped controls and iPhone input zoom.
- Added stable loading feedback for notifications and verified mobile assignment, grading, attendance, navigation, forum, notification, material, and dashboard states.
- Unified the mentee dashboard with the same weighted progress calculation used by the dedicated Progress page.
- Added a single prioritised next action, revision-first assignment links, current-module assignment progress, upcoming commitments, and recent published feedback.
- Added the active cohort name, clear progress factors, resilient dashboard loading, and independent mentor-availability error handling.
- Added URL-backed assignment filters so dashboard links can open the exact assignment or the intended To do view.
- Added automated 48-hour, 24-hour, and deadline-day assignment reminders through the existing platform and email delivery system.
- Limited automated reminders to active cohort mentees who have not submitted or who have an outstanding revision request.
- Added database-enforced reminder deduplication across repeated hourly runs and multiple API processes.
- Separated scheduler deduplication keys from announcement IDs so automated reminders remain outside the Admin announcement history.
- Centralised role-specific notification destinations for assignments, reviews, forum replies, bookings, reports, support tickets, certificates, sessions, private mentor messages, and admin system alerts.
- Added server-side entity filters so exact records remain reachable beyond the first result page without weakening role, cohort, module, or ownership checks.
- Added automatic record focus across mentor reviews and bookings, mentor/admin reports, admin support and certificate review, mentee bookings/support/certificates, forum discussions, session preparation, and direct notification links.
- Added actionable links to the admin notification audit while preserving announcement-provided links.
- Rebuilt the mentee Learn route as a module-based hub that keeps each module's description, mentor, dates, resources, sessions, and assignments together.
- Added Current, Upcoming, and Completed learning stages with live counts to Learn and Assignments while preserving submission-status filters and exact assignment deep links.
- Reused the existing Cohort -> Module -> Session/Resource/Assignment structure, so Phase 2D requires no new content model or production-data migration.
- Added private mentor-question threads tied to an authorised module or assignment, with Open, Answered, and Resolved states.
- Added exact notification and email links for new questions, mentor responses, and mentee follow-ups.
- Added server-enforced participant scope, read-only admin visibility, rich-text sanitisation, preserved message history, and contextual entry points from Learn and Assignments.
- Kept mentor inbox payloads bounded by returning message counts and latest previews in lists, then loading the full history only for an authorised exact thread.
- Added a cohort-based Admin learner overview using the same authoritative assignment, score, attendance, punctuality, ranking, and graduation-readiness calculations used elsewhere in the LMS.
- Added searchable account, progress-risk, and graduation-readiness filters with server pagination that preserves each learner's full-cohort rank.
- Added an exact learner detail modal with recent submissions, attendance history, support status, mentor-question status, certificate state, and objective attention reasons.
- Kept mentor-question messages out of overview responses and limited question subjects to admin and super-admin roles; admin managers receive counts only.
- Added direct Overview actions from the Admin Mentees table and a dedicated Learner Overview navigation route.
- Corrected assignment deadline request preprocessing so date-only assignment creation works through validated HTTP routes while retaining the official Africa/Juba deadline conversion.
- Added independent installable manifests, branded icons, and production service workers for the admin, mentor, and mentee portal origins.
- Added shared install and controlled-update actions, live offline status feedback, and a responsive generic offline page.
- Limited PWA caching to bundled static assets and offline shell files; API responses, uploads, cross-origin resources, and authenticated navigation HTML remain outside the cache.
- Added repeatable PWA output validation and deployment cache rules so new releases can replace the service worker and application shell promptly.

## Existing Architecture

```text
admins/    React + Vite admin portal
mentors/   React + Vite mentor portal
students/  React + Vite mentee and public portal
shared/    Reusable React components, API client, upload, file, date, and status helpers
backend/   Express API, Mongoose models, role middleware, services, validation, and jobs
```

The portals are separate applications but share one API and MongoDB database. This separation should remain because it keeps role-specific bundles and workflows independent.

### Backend foundations

- Express 4 API with Mongoose 8.
- JWT authentication and backend role enforcement.
- Zod request validation.
- Helmet, CORS, HPP, Mongo sanitisation, request limits, and mutation rate limits.
- Rich-text sanitisation before persistence.
- Compressed upload enforcement, file inspection, image optimisation, and Cloudinary storage.
- Resend or SMTP email delivery.
- Request logging, request IDs, health checks, slow-request monitoring, and admin alerts.

### Existing data entities

- `User`
- `Cohort`
- `Module`
- `Session`, including embedded attendance records
- `Resource`
- `Assignment`
- `Submission`
- `Notification`
- `Discussion`
- `MentorQuestion`
- `Reminder`
- `Booking`
- `MentorAvailability`
- `SupportTicket`
- `Report`
- `Certificate`
- `SystemLog`

There is no separate Course or Lesson model. Current BYBS learning content is organised as Cohort -> Module -> Session/Resource/Assignment. Phase 1 should not introduce duplicate Course or Lesson entities without a separate curriculum requirement.

## Reusable Functionality

### Assignment and submission

- Admin and mentor assignment creation, editing, and deletion.
- Cohort and module assignment ownership.
- Official CAT deadline conversion and late-submission calculation.
- Rich-text instructions and written responses.
- File and external-link submissions.
- Compressed upload and Cloudinary handling.
- Mentor assignment ownership and assigned-module review checks.
- Approved scoring, rich-text feedback, revision requests, attachment preview, and private messages.
- Assignment and review notifications through platform and email channels.

### Attendance and progress

- Session-level attendance records with present, absent, late, and excused states.
- `markedBy` and `markedAt` audit fields.
- Mentor session roster and attendance update endpoints.
- Progress calculation based on assignment completion, approved scores, attendance, and punctuality.
- Cohort ranking based on system records rather than mentor opinions.

### Authentication and navigation

- Login, logout, temporary-password change, forgot password, and reset password.
- Separate role-protected portals.
- Requested-route redirect after authentication.
- Shared sticky application shell, mobile navigation, mobile search, profile menu, footer, and global loader.
- Notification unread indicators and modal notification reading.

### Contextual mentor questions

- Mentees can open a private question from a published module or an available assignment.
- The backend selects the module mentor first, then the mentee's primary mentor, then an active cohort mentor.
- Only the originating mentee and fixed assigned mentor can reply or change thread status.
- Admin and super admin roles can inspect question threads through a read-only endpoint for safeguarding and later learner-overview work; admin managers do not receive this sensitive conversation access.
- Every reply remains timestamped in the thread and creates an exact platform/email notification for the other participant.

## Confirmed Gaps

### Assignment trust completed in Phase 1A

- Successful submissions remain open and show a complete, persistent receipt.
- Written responses, links, and selected upload metadata are preserved locally until successful submission.
- Resubmissions archive the prior attempt before creating the active attempt.
- Learners can inspect previous attempt content, files, links, score, feedback, reviewer, and timestamps.
- Assignment list/detail views show date assigned, due date, current state, submission time, exact score, percentage, grader, grading date, and feedback.
- Assignment notifications, reminders, search results, and dashboard actions can open a specific assignment.
- `resubmitted` is now an explicit persisted state. `In progress` remains a client-side draft state until the learner submits.

### Mentor grading completed in Phase 1B

- Mentors can save, restore, and discard a private review draft without notifying the mentee.
- Save Draft and publication are separate backend operations.
- Review publication supports feedback-only, revision requested, and approved/graded outcomes.
- Only approved work accepts a score, and revision requests keep scoring disabled.
- The module-scoped queue supports learner, assignment, submission-date, status, draft, and ordering filters with pagination.
- Queue and review detail views show how long work has waited or how long a published review took.
- Mentors can upload an optional compressed feedback attachment that becomes visible only after publication.

### Attendance completed in Phase 1C

- Attendance uses every non-cancelled session whose start time has passed as the denominator.
- An absent attendance record is represented as `notMarked`, contributes zero until corrected, and remains separate from an explicit `absent` status.
- Learners can inspect session date, title, module, attendance state, and update time behind their summary percentage.
- Admins can open a session roster, mark or correct attendance, remove an incorrect mark back to `notMarked`, and optionally complete the session.
- Every changed status records the learner, previous state, new state, actor, role, timestamp, and correction reason.
- Mentor attendance screens display the saved state and the latest updater while preserving mentor cohort and module scope.

### Dashboard and progress

- Dashboard and Progress page totals now use the same weighted progress service and system records.
- The dashboard prioritises revision requests, overdue work, nearest deadlines, the current module, and the next session without assigning arbitrary progress values.
- Recent published feedback includes its assignment, review state, score when available, reviewer, date, and a direct action to the full record.
- Learn and Assignments now consistently separate current, upcoming, and completed content while retaining assignment workflow filters within each stage.

### Authentication

- Invalid credentials now return the same clear, non-enumerating message whether the email or password is wrong.
- Expired tokens clear the affected portal session, return the user to login with an explanation, and preserve the requested internal destination for the next successful sign-in.
- Existing sessions are validated with `/api/auth/me` before protected content is shown, and signed-in users are redirected away from authentication pages.
- Tokens are stored in browser local storage. Moving to HTTP-only cookies is valuable security work but is intentionally outside the learner-feedback Phase 1 unless scheduled as a dedicated authentication migration.

### Mobile and performance

- Phase 1 priority flows pass repeatable checks at 320, 360, 375, 390, 414, 768, and 1280 pixels without page-level horizontal overflow, unnamed rendered controls, duplicate IDs, or undersized mobile touch targets.
- Priority dialogs trap keyboard focus, close with Escape, restore focus to their trigger, and remain scrollable within the viewport.
- Current production bundles build successfully but trigger Vite's 500 kB chunk warning. Route-level lazy loading should be considered in the low-bandwidth phase.
- There is no automated browser suite covering the three portals.

## Existing API Contracts

### Authentication

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/login` | Authenticate a portal user |
| POST | `/api/auth/forgot-password` | Request a mentor or mentee reset email |
| POST | `/api/auth/reset-password` | Use a one-time password reset token |
| GET | `/api/auth/me` | Return the authenticated user |
| PATCH | `/api/auth/profile` | Update approved public profile fields |
| POST | `/api/auth/profile-image` | Upload a compressed profile image |
| POST | `/api/auth/change-password` | Change the authenticated user's password |

### Mentee learning

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/student/dashboard` | Mentee dashboard summary |
| GET | `/api/student/search` | Search authorised cohort content |
| GET | `/api/student/modules` | Published cohort modules |
| GET | `/api/student/sessions` | Cohort sessions |
| GET | `/api/student/materials` | Published learning resources |
| GET | `/api/student/assignments` | Cohort assignments with the learner submission |
| POST | `/api/student/assignments/:id/submission` | Create or resubmit learner work while preserving prior attempts |
| GET/POST | `/api/student/mentor-questions` | List private questions or create one in an authorised learning context |
| POST | `/api/student/mentor-questions/:id/replies` | Add a mentee follow-up to an owned question |
| PATCH | `/api/student/mentor-questions/:id/status` | Resolve or reopen an owned question |
| GET | `/api/student/progress` | Calculated learner progress |
| GET | `/api/student/notifications` | Learner notifications |
| PATCH | `/api/student/notifications/:id/read` | Mark an owned notification as read |

### Mentor review and attendance

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/mentor/modules` | Mentor-visible assigned modules |
| GET | `/api/mentor/submissions` | Module-scoped learner submissions |
| PATCH | `/api/mentor/submissions/:id/review-draft` | Save a private mentor grading draft |
| DELETE | `/api/mentor/submissions/:id/review-draft` | Discard a private mentor grading draft |
| PATCH | `/api/mentor/submissions/:id/review` | Publish a review, revision request, or approval |
| GET | `/api/mentor/mentor-questions` | List questions fixed to the authenticated mentor |
| POST | `/api/mentor/mentor-questions/:id/replies` | Respond to an assigned mentee question |
| PATCH | `/api/mentor/mentor-questions/:id/status` | Resolve or reopen an assigned question |
| GET | `/api/mentor/sessions` | Mentor-visible sessions |
| GET | `/api/mentor/sessions/:id/attendance` | Session attendance roster |
| PATCH | `/api/mentor/sessions/:id/attendance` | Save authorised attendance records with audit attribution |

### Admin learning operations

| Method | Route | Purpose |
| --- | --- | --- |
| GET/POST | `/api/admin/modules` | List or create modules |
| PATCH/DELETE | `/api/admin/modules/:id` | Update or delete modules |
| GET/POST | `/api/admin/sessions` | List or create sessions |
| PATCH/DELETE | `/api/admin/sessions/:id` | Update or delete sessions |
| GET | `/api/admin/sessions/:id/attendance` | Open the full cohort attendance roster and correction history |
| PATCH | `/api/admin/sessions/:id/attendance` | Correct attendance with a required reason and actor audit |
| GET/POST | `/api/assignments` | List or create assignments |
| PATCH/DELETE | `/api/assignments/:id` | Update or delete assignments |
| GET | `/api/admin/mentor-questions` | Inspect contextual question threads without participant mutation access |

All listed protected endpoints enforce authentication and role checks on the backend. Mentor submission and attendance controllers also validate cohort, module, and learner scope.

## Database Changes

Phase 1A adds optional, backward-compatible fields to `Submission`:

- `attemptNumber`, defaulting to `1`;
- `resubmittedAt`;
- `history`, containing snapshots of prior attempts and their response, files, links, status, score, feedback, reviewer, and timestamps;
- the persisted `resubmitted` lifecycle status;
- indexes on `status + submittedAt` and `student + status` for queue and learner lookups.

Existing submissions require no rewrite: missing `attemptNumber` is presented as attempt 1 and missing `history` is treated as an empty list. On the first resubmission, the current stored attempt is copied into `history` before the active fields are replaced. Existing grades, attendance, assignments, and resources are not deleted or rewritten.

Phase 1B additionally adds:

- `reviewDraft`, excluded from normal Mongoose selections, containing private outcome, score, feedback, attachment, author, and save time;
- `feedbackFileUrl` on published reviews and archived attempt history;
- an index on `reviewDraft.savedAt + submittedAt` for draft queue filtering.

Resubmission clears any stale private draft and archives the previous published feedback attachment with its attempt. Existing submissions without these fields continue to work without a migration.

The existing embedded `Session.attendance` structure is adequate for Phase 1. Accuracy can be fixed through authoritative calculations and correction APIs without moving attendance into a new collection.

Phase 1C adds an optional `Session.attendanceAudit` array containing the learner, previous status, new status, actor, actor role, timestamp, and reason for each actual change. Existing sessions need no migration: missing audit arrays default to empty, and missing learner records are calculated as `notMarked`. Indexes support learner attendance lookup and recent audit ordering.

Phase 2B adds an optional `Notification.dedupeKey`. A unique partial index on `recipient + dedupeKey` makes each automated reminder stage idempotent while leaving existing notifications and announcements valid. Legacy scheduler notifications that stored their key in `announcementId` are recognised and migrated when encountered, preventing a one-time duplicate after deployment.

Phase 2E adds a new `MentorQuestion` collection. Each record stores the mentee, fixed assigned mentor, cohort, module or assignment context, status, resolution audit fields, and an append-only timestamped message thread. This is additive and requires no rewrite of assignments, discussions, notifications, or user records. Existing program-reset archiving now includes the collection.

## Environment Variables

Phase 0 adds no environment variables.

Relevant existing configuration includes:

- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_ADMIN_URL`
- `CLIENT_MENTOR_URL`
- `CLIENT_STUDENT_URL`
- `PUBLIC_API_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `REQUIRE_COMPRESSED_UPLOADS`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SESSION_REMINDER_JOB_ENABLED`
- `SESSION_REMINDER_LEAD_HOURS`
- `ASSIGNMENT_REMINDER_JOB_ENABLED`
- `ASSIGNMENT_REMINDER_INTERVAL_MS`
- `ASSIGNMENT_REMINDER_LEAD_HOURS`
- `ASSIGNMENT_REMINDER_DUE_DAY_HOUR`
- `ASSIGNMENT_REMINDER_BATCH_SIZE`
- `ASSIGNMENT_DEADLINE_TIME_ZONE`
- `ASSIGNMENT_DEFAULT_DEADLINE_TIME`

## Testing

### Phase 0 baseline

- Admin production build: passed.
- Mentor production build: passed.
- Mentee production build: passed.
- Existing database-backed backend suite: 8 passed, 0 failed, 0 skipped.
- Expanded Phase 0 backend suite: 11 passed, 0 failed, 0 skipped.
- Bundle warning: all portals currently produce a main JavaScript chunk larger than 500 kB before gzip.

### Phase 0 regression additions

- Mentee sees only assignments for their own cohort.
- Empty assignment submissions are rejected.
- Valid written submissions are persisted.
- Mentee cannot submit against another cohort's assignment.
- Mentee cannot access mentor submission routes.
- Mentor can approve a submission from their assigned module.
- Mentor cannot review a submission from another mentor's assigned module.
- Present, late, and absent attendance records produce the expected counts and weighted percentage.

### Phase 1A verification

- Database-backed backend suite: 11 passed, 0 failed, 0 skipped, with email delivery disabled.
- Resubmission regression verifies attempt 1 is archived with its original score and feedback, attempt 2 is active, and published review fields are cleared until the new attempt is reviewed.
- Admin, mentor, and mentee production builds: passed.
- Assignment workflow browser checks: passed at 320, 360, 375, 390, 414, 768, and 1280 pixels, plus a reduced-motion landscape viewport.
- Browser checks cover direct assignment opening, rich-text submission, receipt visibility, completed filtering, exact scores, previous attempts, and horizontal overflow.
- Known build warning: each portal still produces a main JavaScript chunk larger than 500 kB before gzip.

### Phase 1B verification

- Private-draft regression verifies that saving a draft leaves the published submission status and score unchanged.
- The mentee assignment endpoint does not expose `reviewDraft`.
- Saving or discarding a draft creates no learner notification; publication creates exactly one.
- Mentor module scope applies to draft and publication endpoints.
- Draft queue metadata and learner/assignment filter options are database-backed.
- Mentor review browser checks pass at 320, 360, 375, 390, 414, 768, and 1280 pixels, plus reduced-motion landscape.
- Browser checks cover queue rendering, waiting time, draft restoration, disabled revision scoring, draft saving, action labels, and horizontal overflow.

### Phase 1C verification

- Backend suite: 12 passed, 0 failed, 0 skipped, including the database-backed checks with email delivery disabled.
- Attendance regression verifies that future and cancelled sessions are excluded while every started non-cancelled session is included.
- An unmarked fourth session changes the weighted result from the old inflated 58% to the authoritative 44%, with 75% roster coverage.
- Admin correction regression verifies the roster endpoint, `notMarked` state, correction reason, before/after history, actor identity, immediate totals, and recalculated 69% attendance.
- A stale-roster regression verifies that a second admin cannot overwrite newer attendance with an older open copy.
- Attendance validation regression accepts 1,000 roster records and rejects requests beyond the supported limit.
- Admin, mentor, and mentee production builds: passed.
- Mentee progress and admin attendance browser checks pass at 320, 360, 375, 390, 414, 768, and 1280 pixels with no console errors or page-level horizontal overflow.
- Browser checks cover compact attendance summaries, learner history, the correction roster, correction history, and horizontally scrollable data tables.
- Known build warning: each portal still produces a main JavaScript chunk larger than 500 kB before gzip.

### Phase 1D verification

- Backend suite: 13 passed, 0 failed, 0 skipped, including safe invalid-credential and invalid-session responses.
- Admin, mentor, and mentee production builds: passed.
- Authentication browser checks pass for all three portals at 320, 360, 375, 390, 414, 768, and 1280 pixels with no application console errors or page-level horizontal overflow.
- Browser checks cover expired-session credential cleanup, session explanations, full deep-link restoration, disabled loading states, safe login errors, and redirects away from login for already authenticated users.
- Mentee mobile navigation exposes the primary journey and retains secondary destinations under More, with the current page identified for assistive technology.
- Known build warning: each portal still produces a main JavaScript chunk larger than 500 kB before gzip.

### Phase 1E verification

- Core mobile workflows pass at 320, 360, 375, 390, 414, 768, and 1280 pixels: mentee assignments and progress, mentor review and attendance, and admin sessions.
- Supporting mobile workflows pass at 390 pixels: mentee dashboard, learning materials, notifications, and forum; mentor dashboard, modules, notifications, and forum; and the admin dashboard.
- Rendered controls have accessible names, images have alternative text, dialogs have accessible names and modal semantics, IDs are unique, and authenticated pages expose one document-level heading.
- Mobile text-entry controls render at 16 pixels or larger and visible button targets measure at least 40 by 40 pixels in the audited workflows.
- Keyboard checks pass for the skip link, mobile navigation, notification modal, forum profile modal, and mentor module modal, including focus trapping, Escape closure, and trigger-focus restoration.
- Dynamically opened forum reply and create-discussion states pass the same control-name, touch-size, text-size, and overflow checks.
- Visual screenshots confirm that the full mentee assignment experience remains readable at 320 pixels and that notification and module dialogs are scrollable and correctly framed at 390 pixels.

### Phase 2A verification

- Backend suite: 14 passed, 0 failed, 0 skipped, including a database-backed dashboard regression.
- The regression verifies the active cohort and module, authoritative weighted progress, module assignment totals, revision-first next action, nearest deadline, next session, and recent feedback preview.
- Admin, mentor, and mentee production builds: passed.
- The revised mentee dashboard passes browser checks at 320, 390, 768, and 1280 pixels with no console errors or page-level horizontal overflow.
- The mobile summary remains two columns, priority content remains visible, and the revision action opens the exact assignment at its deep link.
- Known build warning: each portal still produces a main JavaScript chunk larger than 500 kB before gzip.

### Phase 2B verification

- Backend suite: 16 passed, 0 failed, 0 skipped, with email delivery disabled.
- Eight concurrent attempts using the same recipient and reminder key create exactly one notification.
- Repeated runs in the same reminder stage create no duplicate notification.
- Database-backed coverage verifies 48-hour, 24-hour, and deadline-day reminders.
- Mentees with pending work and revision requests are included; submitted, approved, inactive, and unrelated accounts are excluded.
- Reminder notifications contain an exact assignment deep link and remain separate from announcement records.

### Phase 2C verification

- Backend suite: 17 passed, 0 failed, 0 skipped, with email delivery disabled and an isolated local MongoDB instance.
- Notification-link regression covers every role-specific destination and verifies exact mentor submission filtering.
- A mentor cannot use an exact submission link to retrieve work outside the mentor's assigned module scope.
- Admin, mentor, and mentee production builds pass.
- Focused browser smoke checks confirm an exact mentor review opens on desktop, an exact mentee notification opens in its modal at 390 pixels, and the mobile page has no horizontal overflow.
- Existing Vite warnings remain for JavaScript chunks larger than 500 kB before gzip.

### Phase 2D verification

- Backend suite: 17 passed, 0 failed, 0 skipped, with email delivery disabled and an isolated local MongoDB instance.
- Admin, mentor, and mentee production builds pass.
- The Learn hub groups module resources, sessions, and assignments and correctly switches between Current, Upcoming, and Completed stages.
- Assignment stage tabs preserve the existing To do, Awaiting review, and Completed workflow filters and continue to open exact assignment deep links.
- Browser smoke checks pass at 390 by 844 and 1280 by 900 pixels with no page-level horizontal overflow.
- Existing Vite warnings remain for JavaScript chunks larger than 500 kB before gzip.

### Phase 2E verification

- Backend suite: 18 passed, 0 failed, 0 skipped, with email delivery disabled and an isolated local MongoDB instance.
- The database-backed regression verifies context derivation, rich-text sanitisation, exact notification links, assigned-mentor visibility, unrelated-mentor denial, replies, resolution, and read-only admin access.
- A focused regression verifies list responses omit full message arrays while exact authorised requests retain the complete conversation.
- Admin, mentor, and mentee production builds pass.
- Mentee browser checks verify assignment-context preselection, question creation, exact URL state, and the scrollable private thread at 390 by 844 pixels.
- Mentor browser checks verify exact-link opening and a published response at 1280 by 900 pixels.
- Both browser checks complete with no page-level horizontal overflow.
- Existing Vite warnings remain for JavaScript chunks larger than 500 kB before gzip.

### Phase 2F verification

- Backend suite: 19 passed, 0 failed, 0 skipped, with email delivery disabled and an isolated local MongoDB instance.
- The database-backed regression verifies cohort ranking, risk filtering, graduation readiness, mentor identity, recent support state, certificate state, and bounded mentor-question summaries.
- Admin managers can use the learner overview but cannot receive private mentor-question subjects or messages; mentor access to Admin overview routes is denied.
- The assignment deadline regression now validates the full Zod HTTP request shape in addition to direct deadline conversion.
- Admin, mentor, and mentee production builds pass.
- Browser checks pass at 1280 by 900 and 390 by 844 pixels for cohort overview, risk filtering, desktop tables, mobile learner cards, exact learner URLs, and the scrollable detail modal.
- The tested page and modal have no horizontal overflow; the mobile modal keeps its close control visible while the full record remains scrollable.
- Existing React Router v7 future-flag warnings and Vite bundle-size warnings remain; neither blocks the workflow.

### Phase 3A verification

- Backend regression suite: 19 passed, 0 failed, 0 skipped, with email delivery disabled and an isolated local MongoDB instance.
- Admin, mentor, and mentee production builds pass.
- The PWA validator confirms each build contains a valid standalone manifest, offline page, service worker, and correctly sized regular and maskable icons.
- Real Chrome checks confirm all three service workers activate and control their own portal origin.
- Offline navigation on each origin opens the generic BYBS offline page without exposing previously loaded account content.
- The public mentee page and all three offline pages have no horizontal overflow at 390 by 844 pixels.
- Existing Vite bundle-size warnings remain and are scheduled for route-level code splitting.

## Implementation Order

### Phase 1 - Core trust

1. Assignment submission receipt, retry resilience, local draft preservation, and submission history. **Complete in Phase 1A.**
2. Individual score and feedback presentation. **Complete in Phase 1A.**
3. Mentor grading drafts, publish/revision actions, queue filters, and waiting-time indicators. **Complete in Phase 1B.**
4. Attendance denominator correction, learner history, and admin correction workflow. **Complete in Phase 1C.**
5. Login/session-expiry messaging and navigation refinement. **Complete in Phase 1D.**
6. Mobile and accessibility verification across priority workflows. **Complete in Phase 1E.**

### Phase 2 - Progress and communication

1. Unified learner dashboard and progress presentation. **Complete in Phase 2A.**
2. Automated assignment deadline reminders with duplicate prevention. **Complete in Phase 2B.**
3. Notification deep links to exact assignments and feedback. **Complete in Phase 2C.**
4. Current, upcoming, and completed content organisation. **Complete in Phase 2D.**
5. Contextual mentor questions tied to assignments or modules. **Complete in Phase 2E.**
6. Consolidated admin learner overview. **Complete in Phase 2F.**

### Phase 3 - Convenience and learning tools

1. Installable PWA and offline fallback. **Complete in Phase 3A.**
2. Approved offline learning materials.
3. Quizzes and practice assessments.
4. Architecture for a permission-aware, BYBS-material-grounded AI assistant.

## Known Limitations

- There is no separate Course or Lesson entity.
- Main frontend bundles need route-level code splitting for better low-bandwidth performance.
- Full browser automation and production-data migration rehearsals are not yet part of the repository.

## Phase 3 Entry Gate

Phase 3 may begin when:

- all production builds pass;
- all backend regression tests pass without skips;
- the working tree contains only intentional Phase 0 through Phase 2F changes;
- no production database operation has been run;
- Phase 2F is verified against a copied staging database before production deployment.
