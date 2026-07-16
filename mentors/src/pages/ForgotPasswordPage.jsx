import { ForgotPasswordPage as SharedForgotPasswordPage } from "@bybs/shared";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export function ForgotPasswordPage() {
  const { forgotPassword, isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate replace to="/" />;
  }

  return (
    <SharedForgotPasswordPage
      description="Enter your mentor account email and we will send a secure reset link if it matches BYBS LMS."
      loginPath="/login"
      onRequestReset={forgotPassword}
      title="Mentor password help"
    />
  );
}
