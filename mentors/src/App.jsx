import { GlobalLoader } from "@bybs/shared";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute.jsx";
import { MentorLayout } from "./layouts/MentorLayout.jsx";
import { AttendancePage } from "./pages/AttendancePage.jsx";
import { AvailabilityPage } from "./pages/AvailabilityPage.jsx";
import { BetaFeedbackPage } from "./pages/BetaFeedbackPage.jsx";
import { BookingsPage } from "./pages/BookingsPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { DiscussionsPage } from "./pages/DiscussionsPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { ModulesPage } from "./pages/ModulesPage.jsx";
import { NotificationsPage } from "./pages/NotificationsPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { RemindersPage } from "./pages/RemindersPage.jsx";
import { ReportsPage } from "./pages/ReportsPage.jsx";
import { ReviewsPage } from "./pages/ReviewsPage.jsx";
import { SessionWorkPage } from "./pages/SessionWorkPage.jsx";
import { StudentDetailPage } from "./pages/StudentDetailPage.jsx";
import { StudentsPage } from "./pages/StudentsPage.jsx";

export default function App() {
  return (
    <>
      <GlobalLoader />
      <Routes>
        <Route element={<LoginPage />} path="/login" />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MentorLayout>
                <Routes>
                  <Route element={<DashboardPage />} index />
                  <Route element={<ModulesPage />} path="modules" />
                  <Route element={<StudentsPage />} path="students" />
                  <Route element={<StudentDetailPage />} path="students/:id" />
                  <Route element={<DiscussionsPage />} path="forum" />
                  <Route element={<SessionWorkPage />} path="session-work" />
                  <Route element={<AttendancePage />} path="attendance" />
                  <Route element={<RemindersPage />} path="reminders" />
                  <Route element={<ReviewsPage />} path="reviews" />
                  <Route element={<AvailabilityPage />} path="availability" />
                  <Route element={<BookingsPage />} path="bookings" />
                  <Route element={<NotificationsPage />} path="notifications" />
                  <Route element={<ReportsPage />} path="reports" />
                  <Route element={<BetaFeedbackPage />} path="beta-feedback" />
                  <Route element={<ProfilePage />} path="profile" />
                  <Route element={<Navigate to="/" replace />} path="*" />
                </Routes>
              </MentorLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}
