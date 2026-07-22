# BYBS LMS

This workspace is scaffolded as one backend API with three separate React Vite portals:

- `admins/` - Admin control room
- `mentors/` - Mentor accountability portal
- `students/` - Student learning portal
- `backend/` - Express and MongoDB API
- `shared/` - Reusable UI components, constants, hooks, and helpers

## First Run

Install dependencies from the workspace root:

```bash
npm install
```

Create a backend environment file:

```bash
cp backend/.env.example backend/.env
```

For local development without a MongoDB service installed, use:

```txt
MONGODB_URI=memory
PORT=5050
SEED_SUPER_ADMIN_ON_START=true
```

For production or staging, use a real MongoDB connection string and keep `SEED_SUPER_ADMIN_ON_START=false`.

For steady access by many admins, mentors, and students, production should run the backend as a long-lived service behind HTTPS, with a real MongoDB provider and health checks:

```txt
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=use-a-long-random-secret-at-least-32-characters
MONGO_MAX_POOL_SIZE=20
GLOBAL_RATE_LIMIT_MAX=1500
MUTATION_RATE_LIMIT_MAX=180
```

Use `/health` for liveness checks and `/ready` for database readiness checks.
If the API is scaled to multiple servers, use shared infrastructure for rate limiting and uploads, such as Redis-backed rate limits.
Admin, mentor, and student file uploads pass through the shared internal gzip compressor before upload. The API requires that compression metadata by default, validates and decompresses the file, optimizes images, then stores the final file in Cloudinary when Cloudinary is configured.

Cloudinary upload settings:

```txt
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=bybs-lms/uploads
REQUIRE_COMPRESSED_UPLOADS=true
PUBLIC_API_URL=https://api.example.com
```

Run each part in separate terminals:

```bash
npm run dev:backend
npm run dev:admins
npm run dev:mentors
npm run dev:students
```

Default local ports:

- Backend API: `http://localhost:5050`
- Admin portal: `http://localhost:5173`
- Mentor portal: `http://localhost:5174`
- Student portal: `http://localhost:5175`

## Public Access Page

The student portal root (`/`) is a public BYBS LMS access page that can be shared daily with students and mentors.

- Student login: `/login`
- Student app after login: `/app`
- Mentor login: configured by `VITE_MENTOR_LOGIN_URL` or `VITE_MENTOR_URL`
- Hidden admin redirect: `/admin-access`
- Cohort 4 access guidance is shown on the public page
- Beta application intake is closed for production
- Historical beta records remain available to admins through the direct archive route: `/beta-applications`

Useful frontend variables:

```txt
VITE_MAIN_WEBSITE_URL=https://example.com
VITE_STUDENT_LOGIN_URL=https://students.example.com/login
VITE_MENTOR_LOGIN_URL=https://mentors.example.com/login
VITE_ADMIN_LOGIN_URL=https://admin.example.com/login
```

## First Admin Account

If using a real MongoDB service, seed the first admin after `backend/.env` is configured:

```bash
npm --workspace backend run seed:super-admin
```

If using `MONGODB_URI=memory` with `SEED_SUPER_ADMIN_ON_START=true`, the backend creates the local super admin during startup.

## Admin Alerts

The backend creates admin notifications for server errors and slow requests. To also send email alerts, configure:

```txt
ADMIN_ALERTS_ENABLED=true
ADMIN_ALERT_EMAILS=admin@example.com,ops@example.com
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=BYBS LMS <alerts@example.com>
SLOW_REQUEST_THRESHOLD_MS=3000
```

Announcements use the same email settings for inbox delivery. You can use either Resend or SMTP. If both are configured, SMTP is preferred:

```txt
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mailer@example.com
SMTP_PASS=your_smtp_password
EMAIL_FROM=BYBS LMS <alerts@example.com>
```

If neither SMTP nor `RESEND_API_KEY` is configured, announcements are saved as portal notifications and marked as `Email not configured` in Admin.

For logos and uploaded announcement images to appear inside real email inboxes, the image URLs must be reachable publicly by the recipient's email client. Configure these when deploying:

```txt
PUBLIC_API_URL=https://api.example.com
EMAIL_LOGO_URL=https://admin.example.com/assets/Logo1.png
CERTIFICATE_VERIFY_BASE_URL=https://lms.example.com
```

`CERTIFICATE_VERIFY_BASE_URL` should point to the public mentee LMS domain because certificate QR codes open `/verify-certificate/:code` there.

Mentor/admin welcome emails also use the same email transport and `EMAIL_FROM`. Useful links can be configured globally in `backend/.env`, or entered per mentor while adding them in the Admin Mentors page:

```txt
PUBLIC_WEBSITE_URL=https://example.com
MENTOR_WHATSAPP_URL=https://chat.whatsapp.com/example
MENTOR_CHANNEL_URL=https://example.com/community
SOCIAL_FACEBOOK_URL=https://facebook.com/example
SOCIAL_INSTAGRAM_URL=https://instagram.com/example
SOCIAL_LINKEDIN_URL=https://linkedin.com/company/example
SOCIAL_YOUTUBE_URL=https://youtube.com/@example
```

Accounts created with temporary passwords are marked as requiring a password change. The admin, mentor, and student portals show a password-change panel until the user replaces the temporary password.

## Build Direction

The first milestone is:

> An admin can log in, create a cohort, add students and mentors, create an assignment, and a student can log in and see that assignment.

The admin side has now been expanded to cover the full cohort setup chain:

```txt
Cohorts -> Modules -> Sessions -> Resources -> Assignments -> Students/Mentors
```

After that, the student assignment workflow, mentor review workflow, progress tracking, ranking, reminders, and reports can be layered in cleanly.

Security notes are tracked in [docs/SECURITY.md](docs/SECURITY.md).
Hostinger VPS staging steps are tracked in [deploy/hostinger/HOSTINGER_STAGING.md](deploy/hostinger/HOSTINGER_STAGING.md).
