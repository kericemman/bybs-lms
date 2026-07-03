import { Camera, Save, Upload, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ROLE_LABELS } from "../constants/roles.js";
import { Button } from "./Button.jsx";
import { Card } from "./Card.jsx";
import { PageHeader } from "./PageHeader.jsx";
import { PhoneInput } from "./PhoneInput.jsx";

const inputClassName =
  "h-11 w-full rounded-md border border-bybs-border bg-white px-3 text-sm outline-none transition focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";
const textAreaClassName =
  "min-h-36 w-full rounded-md border border-bybs-border bg-white px-3 py-2 text-sm outline-none transition focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";

function fieldValue(value) {
  return value || "";
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "B") + (parts[1]?.[0] || "");
}

export function ProfileWorkspace({
  description = "Manage your BYBS account details.",
  onUpdateProfile,
  onUploadImage,
  title = "Profile",
  user
}) {
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    name: fieldValue(user?.name),
    phone: fieldValue(user?.phone),
    bio: fieldValue(user?.bio)
  });
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setForm({
      name: fieldValue(user?.name),
      phone: fieldValue(user?.phone),
      bio: fieldValue(user?.bio)
    });
  }, [user?.bio, user?.name, user?.phone]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setFeedback("");

    if (!file.type.startsWith("image/")) {
      setError("Choose a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Profile images must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      await onUploadImage?.(formData);
      setFeedback("Profile picture updated.");
    } catch (requestError) {
      setError(requestError.message || "Profile picture could not be uploaded.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSaving(true);

    try {
      await onUpdateProfile?.({
        name: form.name.trim(),
        phone: form.phone,
        bio: form.bio.trim()
      });
      setFeedback("Profile updated.");
    } catch (requestError) {
      setError(requestError.message || "Profile could not be updated.");
    } finally {
      setIsSaving(false);
    }
  }

  const roleLabel = user?.role ? ROLE_LABELS[user.role] || user.role : "BYBS user";

  return (
    <div className="space-y-6">
      <PageHeader description={description} title={title} />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="self-start">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {user?.profileImage ? (
                <img
                  alt={user.name || "Profile picture"}
                  className="h-32 w-32 rounded-full border border-bybs-border object-cover"
                  src={user.profileImage}
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-full border border-bybs-border bg-bybs-pale text-3xl font-semibold text-bybs-blue">
                  {user?.name ? initials(user.name) : <UserRound className="h-10 w-10" aria-hidden="true" />}
                </div>
              )}
              <span className="absolute bottom-1 right-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bybs-blue text-white ring-4 ring-white">
                <Camera className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>

            <h2 className="mt-4 text-lg font-semibold text-bybs-navy">{user?.name || "BYBS User"}</h2>
            <p className="mt-1 text-sm text-bybs-muted">{roleLabel}</p>
            <p className="mt-1 break-all text-sm text-bybs-body">{user?.email}</p>

            <Button
              className="mt-5 w-full"
              disabled={isUploading}
              icon={Upload}
              onClick={() => fileInputRef.current?.click()}
              type="button"
              variant="secondary"
            >
              {isUploading ? "Uploading..." : "Upload picture"}
            </Button>
            <input
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleImageChange}
              ref={fileInputRef}
              type="file"
            />
          </div>
        </Card>

        <Card>
          <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-bybs-body">Full name</span>
              <input
                className={`${inputClassName} mt-1`}
                onChange={(event) => updateField("name", event.target.value)}
                required
                value={form.name}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-bybs-body">Phone</span>
              <div className="mt-1">
                <PhoneInput onChange={(phone) => updateField("phone", phone)} value={form.phone} />
              </div>
            </label>

            <label className="block lg:col-span-2">
              <span className="text-sm font-medium text-bybs-body">About</span>
              <textarea
                className={`${textAreaClassName} mt-1`}
                onChange={(event) => updateField("bio", event.target.value)}
                placeholder="Write a short profile about your BYBS journey."
                value={form.bio}
              />
            </label>

            {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-2">{error}</p> : null}
            {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue lg:col-span-2">{feedback}</p> : null}

            <div className="lg:col-span-2">
              <Button disabled={isSaving || isUploading} icon={Save} type="submit">
                {isSaving ? "Saving..." : "Save profile"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
