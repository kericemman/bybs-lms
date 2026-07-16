import { ForgotPasswordPage as SharedForgotPasswordPage } from "@bybs/shared";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export function ForgotPasswordPage() {
  const { forgotPassword, isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate replace to="/app" />;
  }

  return (
    <SharedForgotPasswordPage
      description="Enter your mentee account email and we will send a secure reset link if it matches BYBS LMS."
      loginPath="/login"
      onRequestReset={forgotPassword}
      title="Mentee password help"
    />
  );
}
