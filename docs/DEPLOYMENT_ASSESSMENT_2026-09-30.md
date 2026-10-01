# BYBS LMS Deployment Assessment - 30 September 2026

## Decision

The current working tree is a release candidate, but production deployment must wait for the VPS checks in this document. The application code, isolated database regression suite, and three portal builds pass. No production database, user, cohort, submission, or uploaded record was modified during this assessment.

## Security Review

The review covered authentication, role enforcement, cohort and module scoping, rich text, external URLs, uploads, notifications, service-worker caching, environment validation, Nginx headers, tracked secrets, and destructive scripts.

Release blockers corrected during the review:

- Password changes, password resets, and resent temporary credentials now increment a backward-compatible account authentication version. Previously issued JWTs are rejected while the current password-change flow receives a replacement token.
- User-controlled links now accept only HTTP and HTTPS. Executable and embedded-data schemes are rejected before persistence.
- Compressed uploads now enforce their decompressed size before and during gunzip. Invalid envelopes and failed Cloudinary uploads clean up temporary files.
- The new assignment deadline reminder scheduler is opt-in. A deployment without the new environment variable cannot unexpectedly send reminder emails.
- Production preflight now rejects incomplete URLs, MongoDB/JWT, Cloudinary, compression, email, sender, certificate, admin-alert, and super-admin seed configuration before the build and service restart.
- Frontend HTML responses receive CSP, clickjacking, MIME sniffing, referrer, and browser-permission headers through the supplied Nginx configuration.
- Program-reset archives are ignored by Git so archived personal data cannot accidentally enter source control or stop automated deployment.

## Functionality Verification

- Backend regression: 21 passed, 0 failed, 0 skipped, using an isolated local MongoDB and no email delivery.
- Admin production build: passed.
- Mentor production build: passed.
- Mentee production build: passed.
- PWA output validation for all three portals: passed.
- Production preflight script: passed with a complete synthetic production configuration.
- Git whitespace/error check: passed.
- Offline npm advisory cache: zero known production dependency findings. This is not a substitute for a current online registry audit.

## Data Safety

- New database fields are additive and have defaults. Existing users and academic records do not require a destructive migration.
- New indexes support notification deduplication, attendance history, and submission queues. Monitor the first API startup until MongoDB finishes index creation.
- Cleanup scripts are not part of startup or deployment. They remain manual commands with explicit confirmation requirements.
- `SEED_SUPER_ADMIN_ON_START` must remain `false` in production.
- `ASSIGNMENT_REMINDER_JOB_ENABLED` should remain `false` for the first deployment. Enable it only after staging verifies recipients, deadline timezone, email sender, and deduplication.

## Required VPS Gate

1. Create and verify a MongoDB backup or provider snapshot.
2. Confirm the production `.env` values required by `npm run preflight:production`.
3. Run `npm run preflight:production` on the VPS before restarting the service.
4. Merge the updated location and security-header rules into the active Certbot-managed Nginx server blocks. Do not replace the live TLS configuration. Run `sudo nginx -t` before reload.
5. Confirm the deployed service with `/health`, `/ready`, and `bash deploy/hostinger/check-staging.sh`.
6. Sign in as super admin, admin manager, mentor, and mentee without editing or deleting production records.
7. Test one controlled Cloudinary upload, one password change, and one notification using designated test accounts.
8. Confirm the browser console has no CSP violations that block required API, Cloudinary, font, or attachment access.

Pushing this working tree to `main` starts the production GitHub Actions deployment automatically. Do not push until the backup, VPS environment, Nginx syntax, and test accounts are ready.

Phase 3 is paused. The previously completed PWA files remain in the local working tree and have passed validation, but they should be included in or excluded from the release deliberately before the final commit.

## Remaining Risk

- JWTs are still stored in browser local storage. The CSP reduces XSS exposure, but a future authentication phase should move sessions to Secure, HttpOnly, SameSite cookies.
- Uploaded learning resources use publicly reachable Cloudinary delivery URLs. Sensitive future materials should use authenticated or signed delivery.
- Rate limiting is process-local. It is suitable for the current single VPS, but multiple API instances require a shared Redis-backed limiter.
- Admin accounts do not yet have MFA.
- Frontend bundles exceed Vite's 500 kB warning threshold. This affects low-bandwidth performance, not correctness.
- A current online npm advisory audit remains outstanding because this assessment did not export the private dependency inventory to the npm registry.
