import { ChangePasswordPanel, ProfileWorkspace } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";

export function ProfilePage() {
  const { changePassword, updateProfile, uploadProfileImage, user } = useAuth();

  return (
    <div className="space-y-6">
      <ProfileWorkspace
        description="Update your mentor profile, contact number, and about section."
        onUpdateProfile={updateProfile}
        onUploadImage={uploadProfileImage}
        title="My Profile"
        user={user}
      />
      <ChangePasswordPanel
        description="Update your account password when you need to secure or replace your login details."
        force={user?.passwordResetRequired}
        onChangePassword={changePassword}
      />
    </div>
  );
}
