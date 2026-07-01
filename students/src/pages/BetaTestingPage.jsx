import { BetaApplicationPage } from "@bybs/shared";
import { studentApi } from "../services/api.js";

function loginUrl(baseUrl, fallbackPath = "/login") {
  if (!baseUrl) return fallbackPath;
  return `${baseUrl.replace(/\/$/, "")}/login`;
}

const studentLoginUrl = import.meta.env.VITE_STUDENT_LOGIN_URL || "/login";
const mentorLoginUrl = import.meta.env.VITE_MENTOR_LOGIN_URL || loginUrl(import.meta.env.VITE_MENTOR_URL, "http://localhost:5174/login");
const mainWebsiteUrl = import.meta.env.VITE_MAIN_WEBSITE_URL || "https://buildyourbestself.org";

export function BetaTestingPage() {
  return (
    <BetaApplicationPage
      mainWebsiteUrl={mainWebsiteUrl}
      mentorLoginUrl={mentorLoginUrl}
      onBetaApply={studentApi.submitBetaApplication}
      studentLoginUrl={studentLoginUrl}
    />
  );
}
