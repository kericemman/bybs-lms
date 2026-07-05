import { ChangePasswordPanel, ProfileWorkspace } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";

export function ProfilePage() {
  const { changePassword, updateProfile, uploadProfileImage, user } = useAuth();

  return (
    <div className="space-y-6">
      <ProfileWorkspace
        description="Update your admin profile, contact number, about section, and profile picture."
        onUpdateProfile={updateProfile}
        onUploadImage={uploadProfileImage}
        title="Admin profile"
        user={user}
      />
      <ChangePasswordPanel
        description="Use a strong password and update temporary credentials before production access."
        force={user?.passwordResetRequired}
        onChangePassword={changePassword}
      />
    </div>
  );
}
