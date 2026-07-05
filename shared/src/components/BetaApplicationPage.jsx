import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Loader2,
  MailCheck,
  Menu,
  Send,
  Sparkles,
  UserRoundCheck,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./Button.jsx";
import { PhoneInput } from "./PhoneInput.jsx";
import { PublicPageLoader } from "./PublicPageLoader.jsx";

const inputClassName =
  "h-11 w-full min-w-0 rounded-md border border-bybs-border bg-white px-3 text-sm outline-none transition focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";
const textAreaClassName =
  "min-h-36 w-full min-w-0 rounded-md border border-bybs-border bg-white px-3 py-2 text-sm outline-none transition focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";

const hearAboutOptions = [
  "BYBS website",
  "BYBS mentor",
  "BYBS mentee",
  "WhatsApp",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Email",
  "Friend or referral",
  "Community event",
  "Other"
];

const initialForm = {
  applicantType: "student",
  name: "",
  email: "",
  phone: "",
  location: "",
  experienceLevel: "notSet",
  availability: "",
  motivation: "",
  source: "",
  consent: false
};

function Field({ label, children, hint }) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-semibold text-bybs-navy">{label}</span>
      <div className="mt-1.5 min-w-0">{children}</div>
      {hint ? <p className="mt-1.5 text-xs leading-5 text-bybs-muted">{hint}</p> : null}
    </label>
  );
}

function NavLink({ href, children, onClick }) {
  return (
    <a
      className="rounded-md px-3 py-2 text-sm font-semibold text-bybs-body transition hover:bg-bybs-pale hover:text-bybs-blue"
      href={href}
      onClick={onClick}
    >
      {children}
    </a>
  );
}

function TesterNote({ icon: Icon, title, description, tone = "blue" }) {
  const toneClass = tone === "rose" ? "bg-bybs-blush text-bybs-rose" : "bg-bybs-pale text-bybs-blue";

  return (
    <div className="min-w-0 rounded-lg border border-bybs-border bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-bybs-navy">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-bybs-body">{description}</p>
        </div>
      </div>
    </div>
  );
}

function SuccessPanel({ applicantType, alreadyApplied, email, message, onReset }) {
  const portalLabel = applicantType === "mentor" ? "mentor portal" : "mentee portal";

  return (
    <div className="rounded-lg border border-bybs-border bg-white p-4 text-sm text-bybs-body shadow-sm md:col-span-2">
      <div className="flex gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-bybs-pale text-bybs-blue">
          <MailCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-bybs-navy">{message}</p>
          {email ? <p className="mt-1 leading-6">We will use <span className="font-semibold text-bybs-navy">{email}</span> for follow-up.</p> : null}
        </div>
      </div>

      <div className="mt-4 rounded-md bg-bybs-pale p-3">
        <p className="text-sm font-bold text-bybs-navy">What happens next</p>
        <ul className="mt-2 grid gap-2 text-sm leading-6 text-bybs-body">
          <li>1. The BYBS team reviews your application and confirms selected testers.</li>
          <li>2. Selected testers receive access details and instructions by email.</li>
          <li>3. Testing runs from July 3 to July 17, 2026.</li>
          <li>4. If selected, you will test the {portalLabel} and share feedback on what works, what is confusing, and what needs improvement.</li>
        </ul>
        {alreadyApplied ? (
          <p className="mt-3 rounded-md bg-white px-3 py-2 text-sm font-semibold text-bybs-blue">
            You do not need to apply again. Your earlier application remains in the review queue.
          </p>
        ) : null}
      </div>

      <button
        className="mt-3 rounded-md px-2 py-1 text-sm font-semibold text-bybs-body hover:bg-bybs-pale hover:text-bybs-blue"
        onClick={onReset}
        type="button"
      >
        Submit another application
      </button>
    </div>
  );
}

export function BetaApplicationPage({
  brandName = "BYBS LMS",
  logoSrc = "/assets/Logo1.png",
  homeUrl = "/",
  mainWebsiteUrl = "https://buildyourbestself.org",
  studentLoginUrl = "/login",
  mentorLoginUrl = "http://localhost:5174/login",
  onBetaApply
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [feedback, setFeedback] = useState("");
  const [successContext, setSuccessContext] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadingTimer = window.setTimeout(() => setIsPageLoading(false), 350);
    return () => window.clearTimeout(loadingTimer);
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(initialForm);
    setFeedback("");
    setSuccessContext(null);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setSuccessContext(null);
    setIsSubmitting(true);

    try {
      const submittedApplicantType = form.applicantType;
      const submittedEmail = form.email.trim();
      const response = await onBetaApply?.({
        ...form,
        name: form.name.trim(),
        email: submittedEmail,
        location: form.location.trim(),
        availability: form.availability.trim(),
        motivation: form.motivation.trim(),
        source: form.source.trim()
      });

      if (response?.data?.alreadyApplied) {
        setFeedback("You already applied. Your application is still saved in the beta queue.");
        setSuccessContext({ alreadyApplied: true, applicantType: submittedApplicantType, email: submittedEmail });
      } else {
        setFeedback("Application received. The BYBS team will review it and contact selected testers.");
        setSuccessContext({ alreadyApplied: false, applicantType: submittedApplicantType, email: submittedEmail });
      }

      setForm(initialForm);
    } catch (requestError) {
      setError(requestError.message || "Application could not be submitted.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const navLinks = [
    { label: "Public page", href: homeUrl },
    { label: "Main website", href: mainWebsiteUrl },
    { label: "Mentee login", href: studentLoginUrl },
    { label: "Mentor login", href: mentorLoginUrl }
  ];

  if (isPageLoading) {
    return <PublicPageLoader brandName={brandName} label="Loading beta testing..." logoSrc={logoSrc} />;
  }

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-bybs-page font-sans text-bybs-text">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-bybs-border bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <a className="flex min-w-0 max-w-[calc(100%-3.25rem)] items-center gap-3 lg:max-w-none" href={homeUrl}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white">
              <img alt={brandName} className="h-9 w-9 object-contain" src={logoSrc} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-bybs-navy">Build Your Best Self</p>
              <p className="truncate text-xs font-semibold text-bybs-muted">Beta testing application</p>
            </div>
          </a>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <NavLink href={link.href} key={link.label}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-bybs-body transition hover:bg-bybs-pale hover:text-bybs-blue lg:hidden"
            onClick={() => setMenuOpen((current) => !current)}
            type="button"
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {menuOpen ? (
          <nav className="border-t border-bybs-border bg-white px-4 py-3 lg:hidden">
            <div className="mx-auto grid max-w-7xl gap-2">
              {navLinks.map((link) => (
                <NavLink href={link.href} key={link.label} onClick={() => setMenuOpen(false)}>
                  {link.label}
                </NavLink>
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      <main className="flex-1 pt-16">
        <section className="border-b border-bybs-border bg-white">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-8 lg:px-8 lg:py-14">
            <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
              <Button as="a" href={homeUrl} icon={ArrowLeft} size="sm" variant="secondary">
                Back to public page
              </Button>
              <p className="mt-7 text-sm font-bold uppercase tracking-[0.16em] text-bybs-rose">BYBS LMS beta</p>
              <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-bybs-navy sm:text-5xl lg:text-6xl">
                Help us shape the BYBS learning experience.
              </h1>
              <p className="mt-5 text-base leading-8 text-bybs-body">
                We are inviting mentees and mentors to test real BYBS workflows before the wider rollout: assignments,
                reminders, resources, feedback, support, and notifications.
              </p>

              <div className="mt-7 grid gap-3">
                <TesterNote
                  description="The beta testing window runs for two weeks, from July 3 to July 17, 2026."
                  icon={CalendarCheck}
                  title="Beta testing dates"
                />
                <TesterNote
                  description="Check modules, session materials, assignment submissions, support tickets, and notifications from a learner's point of view."
                  icon={GraduationCap}
                  title="Mentee testers"
                />
                <TesterNote
                  description="Check assigned modules, session work upload, mentee reminders, reviews, and progress tracking from a mentor's point of view."
                  icon={UserRoundCheck}
                  title="Mentor testers"
                  tone="rose"
                />
                <TesterNote
                  description="You do not need to be technical. We need honest notes about what feels clear, confusing, slow, or missing."
                  icon={Sparkles}
                  title="Practical feedback"
                />
              </div>
            </div>

            <form
              aria-busy={isSubmitting}
              className="relative grid min-w-0 grid-cols-1 gap-4 overflow-hidden rounded-lg border border-bybs-border bg-bybs-page p-3 shadow-sm sm:p-5 md:grid-cols-2 lg:p-6"
              onSubmit={handleSubmit}
            >
              {isSubmitting ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 p-4 backdrop-blur-sm">
                  <div className="grid justify-items-center gap-3 rounded-lg border border-bybs-border bg-white p-5 text-center shadow-sm">
                    <Loader2 className="h-7 w-7 animate-spin text-bybs-blue" aria-hidden="true" />
                    <p className="text-sm font-bold text-bybs-navy">Submitting your application...</p>
                    <p className="max-w-xs text-xs leading-5 text-bybs-body">Please keep this page open while we save your beta testing application.</p>
                  </div>
                </div>
              ) : null}

              <fieldset className="contents" disabled={isSubmitting}>
                <div className="border-b border-bybs-border pb-4 md:col-span-2">
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-bybs-blue">Application form</p>
                  <h2 className="mt-2 text-2xl font-extrabold text-bybs-navy">Tell us how you can help test</h2>
                  <p className="mt-2 text-sm leading-6 text-bybs-body">
                    Selected testers will be contacted by the BYBS team with access details and next steps. Testing runs
                    from July 3 to July 17, 2026.
                  </p>
                </div>

                <Field label="I am applying as">
                  <select className={inputClassName} onChange={(event) => updateField("applicantType", event.target.value)} value={form.applicantType}>
                    <option value="student">Mentee tester</option>
                    <option value="mentor">Mentor tester</option>
                  </select>
                </Field>
                <Field label="Full name">
                  <input className={inputClassName} onChange={(event) => updateField("name", event.target.value)} required value={form.name} />
                </Field>
                <Field label="Email">
                  <input className={inputClassName} onChange={(event) => updateField("email", event.target.value)} required type="email" value={form.email} />
                </Field>
                <Field label="Phone" hint="Include the country code so the team can reach you easily.">
                  <PhoneInput onChange={(phone) => updateField("phone", phone)} value={form.phone} />
                </Field>
                <Field label="Location">
                  <input className={inputClassName} onChange={(event) => updateField("location", event.target.value)} placeholder="City, country" value={form.location} />
                </Field>
                <Field label="Experience">
                  <select className={inputClassName} onChange={(event) => updateField("experienceLevel", event.target.value)} value={form.experienceLevel}>
                    <option value="notSet">Prefer not to say</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="mentor">I already mentor or coach</option>
                  </select>
                </Field>
                <Field label="Availability">
                  <input
                    className={inputClassName}
                    onChange={(event) => updateField("availability", event.target.value)}
                    placeholder="Evenings, weekends, 2 hours weekly"
                    value={form.availability}
                  />
                </Field>
                <Field label="Where did you hear about us?">
                  <select className={inputClassName} onChange={(event) => updateField("source", event.target.value)} value={form.source}>
                    <option value="">Select one</option>
                    {hearAboutOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <Field label="Why do you want to test BYBS LMS?">
                    <textarea
                      className={textAreaClassName}
                      onChange={(event) => updateField("motivation", event.target.value)}
                      placeholder="Tell us how you plan to use the platform and what kind of feedback you can provide."
                      required
                      value={form.motivation}
                    />
                  </Field>
                </div>
                <label className="flex min-w-0 items-start gap-3 rounded-md border border-bybs-border bg-white p-3 text-sm leading-6 text-bybs-body md:col-span-2">
                  <input
                    checked={form.consent}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-bybs-border text-bybs-blue"
                    onChange={(event) => updateField("consent", event.target.checked)}
                    required
                    type="checkbox"
                  />
                  <span className="min-w-0">I agree that BYBS may contact me about beta testing and store this application for review.</span>
                </label>

                {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm font-semibold text-bybs-rose md:col-span-2">{error}</p> : null}
                {feedback ? (
                  <SuccessPanel
                    alreadyApplied={successContext?.alreadyApplied}
                    applicantType={successContext?.applicantType}
                    email={successContext?.email}
                    message={feedback}
                    onReset={resetForm}
                  />
                ) : null}

                <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row">
                  <Button className={`w-full sm:w-auto ${isSubmitting ? "[&_svg]:animate-spin" : ""}`} disabled={isSubmitting} icon={isSubmitting ? Loader2 : Send} type="submit">
                    {isSubmitting ? "Submitting..." : "Submit application"}
                  </Button>
                  <Button as="a" className="w-full sm:w-auto" href={mainWebsiteUrl} variant="secondary">
                    Visit main website
                  </Button>
                </div>
              </fieldset>
            </form>
          </div>
        </section>

        <section className="bg-bybs-pale">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
            <div className="flex gap-3">
              <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-bybs-blue" aria-hidden="true" />
              <p className="text-sm leading-6 text-bybs-body">Test learning materials, assignment flow, and feedback clarity.</p>
            </div>
            <div className="flex gap-3">
              <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-bybs-rose" aria-hidden="true" />
              <p className="text-sm leading-6 text-bybs-body">Share useful notes about navigation, speed, content, and missing steps.</p>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-bybs-blue" aria-hidden="true" />
              <p className="text-sm leading-6 text-bybs-body">Help BYBS prepare a calmer, clearer rollout for the full community.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-bybs-navy px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img alt={brandName} className="h-10 w-10 rounded-md bg-white object-contain p-1" src={logoSrc} />
            <div>
              <p className="text-sm font-bold">Build Your Best Self</p>
              <p className="mt-1 text-sm text-white/70">Beta testing for the BYBS learning community.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a className="text-white/80 hover:text-white" href={homeUrl}>Public page</a>
            <a className="text-white/80 hover:text-white" href={mainWebsiteUrl}>Main website</a>
            <a className="text-white/80 hover:text-white" href={studentLoginUrl}>Mentee login</a>
            <a className="text-white/80 hover:text-white" href={mentorLoginUrl}>Mentor login</a>
          </div>
          <p className="text-sm text-white/70">Designed and maintained by TDAG.</p>
        </div>
      </footer>
    </div>
  );
}
