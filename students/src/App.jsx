import { GlobalLoader } from "@bybs/shared";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { ProtectedRoute } from "./auth/ProtectedRoute.jsx";
import { StudentLayout } from "./layouts/StudentLayout.jsx";
import { AdminAccessRedirect } from "./pages/AdminAccessRedirect.jsx";
import { AssignmentsPage } from "./pages/AssignmentsPage.jsx";
import { BetaTestingPage } from "./pages/BetaTestingPage.jsx";
import { BetaFeedbackPage } from "./pages/BetaFeedbackPage.jsx";
import { BookingsPage } from "./pages/BookingsPage.jsx";
import { CertificatesPage } from "./pages/CertificatesPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { DiscussionsPage } from "./pages/DiscussionsPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { MaterialsPage } from "./pages/MaterialsPage.jsx";
import { NotificationsPage } from "./pages/NotificationsPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { ProgressPage } from "./pages/ProgressPage.jsx";
import { PublicPage } from "./pages/PublicPage.jsx";
import { SupportPage } from "./pages/SupportPage.jsx";
import { VerifyCertificatePage } from "./pages/VerifyCertificatePage.jsx";

export default function App() {
  return (
    <AuthProvider>
      <>
        <GlobalLoader />
        <Routes>
          <Route element={<PublicPage />} path="/" />
          <Route element={<BetaTestingPage />} path="/beta-testing" />
          <Route element={<VerifyCertificatePage />} path="/verify-certificate/:code" />
          <Route element={<VerifyCertificatePage />} path="/v/:code" />
          <Route element={<LoginPage />} path="/login" />
          <Route element={<AdminAccessRedirect />} path="/admin-access" />
          <Route
            element={
              <ProtectedRoute>
                <StudentLayout>
                  <Routes>
                    <Route element={<DashboardPage />} index />
                    <Route element={<MaterialsPage />} path="materials" />
                    <Route element={<DiscussionsPage />} path="forum" />
                    <Route element={<AssignmentsPage />} path="assignments" />
                    <Route element={<ProgressPage />} path="progress" />
                    <Route element={<CertificatesPage />} path="certificates" />
                    <Route element={<BookingsPage />} path="bookings" />
                    <Route element={<NotificationsPage />} path="notifications" />
                    <Route element={<ProfilePage />} path="profile" />
                    <Route element={<BetaFeedbackPage />} path="beta-feedback" />
                    <Route element={<SupportPage />} path="support" />
                    <Route element={<Navigate to="/app" replace />} path="*" />
                  </Routes>
                </StudentLayout>
              </ProtectedRoute>
            }
            path="/app/*"
          />
          <Route element={<Navigate to="/" replace />} path="*" />
        </Routes>
      </>
    </AuthProvider>
  );
}
