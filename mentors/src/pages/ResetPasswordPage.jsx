import { ResetPasswordPage as SharedResetPasswordPage } from "@bybs/shared";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export function ResetPasswordPage() {
  const { isAuthenticated, resetPassword } = useAuth();
  const [searchParams] = useSearchParams();

  if (isAuthenticated) {
    return <Navigate replace to="/" />;
  }

  return (
    <SharedResetPasswordPage
      description="Choose a new password for your mentor account."
      loginPath="/login"
      onResetPassword={resetPassword}
      title="Reset mentor password"
      token={searchParams.get("token") || ""}
    />
  );
}
