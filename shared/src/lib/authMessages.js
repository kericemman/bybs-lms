export function loginErrorMessage(error) {
  if (error?.status === 401) {
    return "The email or password you entered is incorrect.";
  }

  if (error?.status === 403) {
    return "This account is not currently active. Contact BYBS support if you think this is a mistake.";
  }

  if (error?.status === 429) {
    return "Too many sign-in attempts. Please wait a few minutes and try again.";
  }

  if (Number(error?.status) >= 500) {
    return "BYBS LMS could not sign you in right now. Please try again shortly.";
  }

  if (error?.name === "TypeError") {
    return "We could not reach BYBS LMS. Check your connection and try again.";
  }

  if (String(error?.message || "").startsWith("This portal is only for")) {
    return error.message;
  }

  return "We could not sign you in. Check your details and try again.";
}
