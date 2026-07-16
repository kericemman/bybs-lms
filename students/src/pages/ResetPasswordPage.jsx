import { ResetPasswordPage as SharedResetPasswordPage } from "@bybs/shared";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export function ResetPasswordPage() {
  const { isAuthenticated, resetPassword } = useAuth();
  const [searchParams] = useSearchParams();

  if (isAuthenticated) {
    return <Navigate replace to="/app" />;
  }

  return (
    <SharedResetPasswordPage
      description="Choose a new password for your mentee account."
      loginPath="/login"
      onResetPassword={resetPassword}
      title="Reset mentee password"
      token={searchParams.get("token") || ""}
    />
  );
}
