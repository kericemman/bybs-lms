# BYBS LMS Security Baseline

Security is part of the product foundation because the LMS handles student identities, submissions, mentor notes, rankings, and admin controls.

## Current Controls

- Role-based API access for admin, mentor, student, and super admin users
- JWT authentication with production secret validation
- Bcrypt password hashing
- Login request validation
- Login rate limiting
- Global API and mutating-request rate limiting
- CORS allow-list for the three portals
- Helmet security headers
- Disabled `x-powered-by` header
- Request IDs returned on API errors for safer support/debugging
- Unsafe payload key rejection for common NoSQL-style abuse
- Production error responses avoid leaking server details
- Admin-level account creation and updates require a super admin
- Mentor assignment access is scoped to the mentor's cohort
- Mentor assignment actions are also scoped to modules assigned to that mentor
- Temporary student and mentor passwords are generated per account in the admin UI
- Mentor/admin welcome emails send the temporary password only during account creation and report delivery status back to Admin
- Accounts created with temporary passwords are marked as requiring a password change
- Admin, mentor, and student portals show a change-password panel until temporary credentials are replaced
- In-memory MongoDB is blocked in production and only available through explicit local configuration
- User deletion is soft-removal to preserve linked academic records
- Permanent mentor deletion is limited to super admins, requires prior removal, and is blocked when linked history exists
- Resource uploads enforce MIME type, file extension, and size limits
- Admin, mentor, and student uploads are compressed internally before upload when the browser supports native compression
- The frontend now blocks file uploads if a browser cannot prepare the compressed upload envelope
- The backend rejects resource and CSV uploads that bypass the compressed upload metadata by default
- The API validates compressed upload metadata and decompresses files before storage or CSV parsing
- Cloudinary-backed uploads are signed server-side, with local `/uploads` storage only used when Cloudinary is not configured
- CSV student import reports row-level errors and skips duplicate emails

## Rules for Future Work

- Never store passwords, tokens, API keys, or reset codes in plain text.
- Never trust the frontend for authorization. Every protected action must be checked in the backend.
- Keep student, mentor, and admin data scoped by role and cohort.
- Use pagination on all list endpoints.
- Store uploaded documents outside the API server in production, preferably with signed/private access for learning materials.
- Keep uploads going through the shared upload client so compression and metadata checks are not bypassed.
- Add audit logs for sensitive actions such as login failures, password resets, role changes, removals, scoring, and exports.
- Add tests for authorization boundaries before launching.

## Production Checklist

- Set a strong `JWT_SECRET` with at least 32 characters.
- Use HTTPS only.
- Use secure database credentials.
- Configure database backups.
- Configure server monitoring and error alerts.
- Configure `/health` for liveness checks and `/ready` for database readiness checks.
- Run the API behind HTTPS with a reverse proxy/load balancer.
- Use a process manager or container platform that sends `SIGTERM` and waits for graceful shutdown.
- Rotate secrets if any environment file is exposed.
- Keep temporary-password sharing only for controlled beta. For public production, move to single-use invite/password reset links.
- Use external rate limiting, such as Redis-backed limiting, if the API runs across multiple servers.
