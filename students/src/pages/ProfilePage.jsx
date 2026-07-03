import { ProfileWorkspace } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";

export function ProfilePage() {
  const { updateProfile, uploadProfileImage, user } = useAuth();

  return (
    <ProfileWorkspace
      description="Update your mentee profile, contact number, and about section."
      onUpdateProfile={updateProfile}
      onUploadImage={uploadProfileImage}
      title="My Profile"
      user={user}
    />
  );
}
