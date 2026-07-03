import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { useAuth } from "./auth/AuthContext.jsx";
import { ProtectedRoute } from "./auth/ProtectedRoute.jsx";
import { AdminLayout } from "./layouts/AdminLayout.jsx";
import { AdminManagersPage } from "./pages/AdminManagersPage.jsx";
import { AssignmentsPage } from "./pages/AssignmentsPage.jsx";
import { AnnouncementsPage } from "./pages/AnnouncementsPage.jsx";
import { BetaApplicationsPage } from "./pages/BetaApplicationsPage.jsx";
import { BookingsPage } from "./pages/BookingsPage.jsx";
import { CohortsPage } from "./pages/CohortsPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { DiscussionsPage } from "./pages/DiscussionsPage.jsx";
import { ModulesPage } from "./pages/ModulesPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { MentorsPage } from "./pages/MentorsPage.jsx";
import { NotificationsPage } from "./pages/NotificationsPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { ReportsPage } from "./pages/ReportsPage.jsx";
import { ResourcesPage } from "./pages/ResourcesPage.jsx";
import { SessionsPage } from "./pages/SessionsPage.jsx";
import { SettingsPage } from "./pages/SettingsPage.jsx";
import { StudentsPage } from "./pages/StudentsPage.jsx";
import { SupportPage } from "./pages/SupportPage.jsx";
import { SystemLogsPage } from "./pages/SystemLogsPage.jsx";
import { hasRole } from "./utils/permissions.js";

function RoleGate({ roles, children }) {
  const { user } = useAuth();

  if (!hasRole(user, roles)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<LoginPage />} path="/login" />
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Routes>
                  <Route element={<DashboardPage />} path="/" />
                  <Route element={<CohortsPage />} path="/cohorts" />
                  <Route element={<ModulesPage />} path="/modules" />
                  <Route element={<SessionsPage />} path="/sessions" />
                  <Route element={<ResourcesPage />} path="/resources" />
                  <Route element={<AssignmentsPage />} path="/assignments" />
                  <Route element={<StudentsPage />} path="/students" />
                  <Route element={<MentorsPage />} path="/mentors" />
                  <Route
                    element={
                      <RoleGate roles={["superAdmin"]}>
                        <AdminManagersPage />
                      </RoleGate>
                    }
                    path="/admin-managers"
                  />
                  <Route element={<BookingsPage />} path="/bookings" />
                  <Route element={<ReportsPage />} path="/reports" />
                  <Route element={<DiscussionsPage />} path="/discussions" />
                  <Route element={<AnnouncementsPage />} path="/announcements" />
                  <Route
                    element={
                      <RoleGate roles={["admin", "superAdmin"]}>
                        <NotificationsPage />
                      </RoleGate>
                    }
                    path="/notifications"
                  />
                  <Route element={<SupportPage />} path="/support" />
                  <Route element={<BetaApplicationsPage />} path="/beta-applications" />
                  <Route
                    element={
                      <RoleGate roles={["admin", "superAdmin"]}>
                        <SystemLogsPage />
                      </RoleGate>
                    }
                    path="/system-logs"
                  />
                  <Route
                    element={
                      <RoleGate roles={["admin", "superAdmin"]}>
                        <SettingsPage />
                      </RoleGate>
                    }
                    path="/settings"
                  />
                  <Route element={<ProfilePage />} path="/profile" />
                  <Route element={<Navigate to="/" replace />} path="*" />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          }
          path="/*"
        />
        <Route element={<Navigate to="/" replace />} path="*" />
      </Routes>
    </AuthProvider>
  );
}
