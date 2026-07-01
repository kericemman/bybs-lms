# BYBS LMS Architecture

## Workspace Shape

```txt
backend/   Express API, MongoDB models, auth, services, uploads
admins/    Admin React Vite portal
mentors/   Mentor React Vite portal
students/  Student React Vite portal
shared/    Reusable UI, constants, hooks, and helpers
```

Each frontend is intentionally separate. This makes it easier to deploy, scale, and redesign each portal without forcing admin, mentor, and student workflows into the same app.

## Shared Backend

All portals use the same API and database. The backend owns:

- Authentication and role-based access
- Users, cohorts, modules, sessions, resources, assignments, and submissions
- Mentor availability and bookings
- Support tickets, reports, notifications, and system logs
- Progress and ranking calculations

## Build Order

1. Authentication and role guards
2. Admin cohort, student, and mentor management
3. Assignment creation and student submission flow
4. Mentor review and feedback flow
5. Progress tracking and ranking
6. Notifications, reports, exports, and production hardening

## Implemented First Slice

- Admin login route and protected admin pages
- Backend JWT authentication and role guards
- Admin endpoints for users, cohorts, and assignments
- Super admin seed script
- Local development embedded MongoDB option for machines without MongoDB installed
- Admin UI forms for cohorts, mentors, students, and assignments

## Admin Portal Coverage

The admin portal now has routes and backend-backed sections for:

- Dashboard
- Cohorts
- Modules
- Sessions
- Resources
- Assignments
- Students
- Mentors
- Bookings
- Reports
- Discussions
- Announcements
- Notifications
- Support tickets
- System logs
- Settings
- Profile

The setup-critical chain is now represented in the UI:

```txt
Cohort -> Modules -> Sessions -> Resources -> Assignments -> Students/Mentors
```

Some sections are intentionally list-first until student and mentor workflows generate real records, especially bookings, reports, support tickets, notifications, and system logs.

## Admin Deepening

The Admin portal now includes deeper operational controls:

- Filters for setup-heavy lists such as cohorts, modules, sessions, resources, assignments, students, mentors, and discussions
- Edit and delete/remove actions for core setup records
- Soft removal for users instead of destructive user deletion
- CSV import for students
- Resource file upload for local development
- Status actions for bookings and support tickets

Student CSV import supports these headers:

```txt
name,email,phone,cohort,mentor,password,status
```

`cohort` can be a cohort ID or exact cohort title. `mentor` can be a mentor ID, email, or exact name. If `password` is blank, the backend generates a temporary password.

Resource uploads go through the shared compression helper, backend validation, decompression, image optimization, and then Cloudinary storage when Cloudinary is configured. Local `UPLOAD_DIR` storage remains as a development fallback.

## Scaling Notes

For 1,000 monthly users, this structure is enough if the app uses database indexes, pagination, Cloudinary-backed file storage, and basic monitoring. Files should not be stored permanently on the API server in production.
