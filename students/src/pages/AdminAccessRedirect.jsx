import { useEffect } from "react";

function loginUrl(baseUrl, fallback) {
  if (!baseUrl) return fallback;
  return `${baseUrl.replace(/\/$/, "")}/login`;
}

const adminLoginUrl = import.meta.env.VITE_ADMIN_LOGIN_URL || loginUrl(import.meta.env.VITE_ADMIN_URL, "http://localhost:5173/login");

export function AdminAccessRedirect() {
  useEffect(() => {
    window.location.replace(adminLoginUrl);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bybs-page px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-bybs-border bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase text-bybs-blue">BYBS Admin</p>
        <h1 className="mt-2 text-xl font-semibold text-bybs-navy">Opening admin portal</h1>
        <p className="mt-2 text-sm text-bybs-body">You are being redirected to the private admin login.</p>
        <a className="mt-5 inline-flex rounded-md bg-bybs-blue px-4 py-2 text-sm font-medium text-white" href={adminLoginUrl}>
          Continue
        </a>
      </section>
    </main>
  );
}
