import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  Menu,
  MessageCircle,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundCheck,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./Button.jsx";
import { PublicPageLoader } from "./PublicPageLoader.jsx";

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

function Pillar({ icon: Icon, title, description }) {
  return (
    <article className="rounded-lg border border-bybs-border bg-white p-5 shadow-sm">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-bybs-pale text-bybs-blue">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-bold text-bybs-navy">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-bybs-body">{description}</p>
    </article>
  );
}

function MethodStep({ number, icon: Icon, title, description }) {
  return (
    <article className="relative rounded-lg border border-bybs-border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-bybs-blue text-sm font-bold text-white">
          {number}
        </span>
        <Icon className="h-5 w-5 shrink-0 text-bybs-rose" aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-base font-bold text-bybs-navy">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-bybs-body">{description}</p>
    </article>
  );
}

function PortalCard({ href, icon: Icon, title, description, action, tone = "blue" }) {
  const toneClass = tone === "rose" ? "bg-bybs-blush text-bybs-rose" : "bg-bybs-pale text-bybs-blue";

  return (
    <a
      className="group block rounded-lg border border-bybs-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      href={href}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-bybs-navy">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-bybs-body">{description}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-bold text-bybs-blue">
          {action}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </a>
  );
}

function FeatureItem({ icon: Icon, title, description }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-bybs-blue ring-1 ring-bybs-border">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div>
        <h3 className="text-sm font-bold text-bybs-navy">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-bybs-body">{description}</p>
      </div>
    </div>
  );
}

function Signal({ title, description }) {
  return (
    <div className="border-l-2 border-bybs-gold pl-4">
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-white/70">{description}</p>
    </div>
  );
}

export function PublicGatewayPage({
  brandName = "BYBS LMS",
  logoSrc = "/assets/Logo1.png",
  mainWebsiteUrl = "https://buildyourbestself.org",
  studentLoginUrl = "/login",
  mentorLoginUrl = "http://localhost:5174/login"
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    const loadingTimer = window.setTimeout(() => setIsPageLoading(false), 350);
    return () => window.clearTimeout(loadingTimer);
  }, []);

  const navLinks = [
    { label: "About", href: "#about" },
    { label: "Portals", href: "#portals" },
    { label: "Cohort 4", href: "#cohort-4" },
    { label: "BYBS website", href: mainWebsiteUrl }
  ];

  if (isPageLoading) {
    return <PublicPageLoader brandName={brandName} label="Loading BYBS LMS..." logoSrc={logoSrc} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-bybs-page font-sans text-bybs-text">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-bybs-border bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a className="flex min-w-0 items-center gap-3" href="#top">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white">
              <img alt={brandName} className="h-9 w-9 object-contain" src={logoSrc} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-bybs-navy">Build Your Best Self</p>
              <p className="truncate text-xs font-semibold text-bybs-muted">Inspire, Heal, Evolve</p>
            </div>
          </a>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <NavLink href={link.href} key={link.label}>
                {link.label}
              </NavLink>
            ))}
            <Button as="a" href={studentLoginUrl} size="sm" variant="secondary">
              Mentee login
            </Button>
            <Button as="a" href={mentorLoginUrl} size="sm" variant="secondary">
              Mentor login
            </Button>
            <Button as="a" href="#cohort-4" size="sm">
              Cohort 4 access
            </Button>
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
              <div className="grid gap-2 pt-1 sm:grid-cols-3">
                <Button as="a" href={studentLoginUrl} onClick={() => setMenuOpen(false)} size="sm" variant="secondary">
                  Mentee login
                </Button>
                <Button as="a" href={mentorLoginUrl} onClick={() => setMenuOpen(false)} size="sm" variant="secondary">
                  Mentor login
                </Button>
                <Button as="a" href="#cohort-4" onClick={() => setMenuOpen(false)} size="sm">
                  Cohort 4 access
                </Button>
              </div>
            </div>
          </nav>
        ) : null}
      </header>

      <main id="top" className="flex-1 pt-16">
        <section className="relative isolate overflow-hidden bg-bybs-navy text-white">
          <img
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-5rem] right-[-5rem] h-80 w-80 object-contain opacity-[0.08] sm:h-[32rem] sm:w-[32rem] lg:bottom-[-7rem] lg:right-[-2rem] lg:h-[42rem] lg:w-[42rem]"
            src={logoSrc}
          />
          <div className="absolute inset-x-0 bottom-0 h-1 bg-bybs-gold" aria-hidden="true" />
          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="max-w-3xl">
             
              <p className="mt-7 text-sm font-bold uppercase tracking-[0.18em] text-bybs-gold">
                Inspire. Heal. Evolve.
              </p>
              <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold leading-[0.98] tracking-normal text-white sm:text-6xl lg:text-7xl">
                Build Your Best Self 
              </h1>
              <h2 className="mt-3 max-w-3xl text-lg font-bold leading-8 text-gray-300 sm:text-xl">
                LEARNING MANAGEMENT SYSTEM
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/80 sm:text-lg">
                A digital learning and mentorship platform created to support BYBS mentees, mentors, and program teams
                throughout the fellowship journey.
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
                The LMS brings learning materials, assignments, mentorship sessions, discussions, progress tracking,
                reports, and support into one organized space for personal growth.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button as="a" className="w-full sm:w-auto" href={mainWebsiteUrl} icon={Sparkles} size="lg" variant="secondary">
                  Visit buildyourbestself.org
                </Button>
                <Button as="a" className="w-full sm:w-auto" href={studentLoginUrl} icon={GraduationCap} size="lg">
                  Mentee login
                </Button>
                <Button as="a" className="w-full sm:w-auto" href={mentorLoginUrl} icon={UserRoundCheck} size="lg" variant="secondary">
                  Mentor login
                </Button>
              </div>
            </div>

            <div className="mt-12 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
              <Signal title="Mentees" description="Access resources, submit assignments, track progress, join discussions, and connect with mentors." />
              <Signal title="Mentors" description="Review submissions, upload resources, manage sessions, send reminders, and report mentee growth." />
              <Signal title="Program teams" description="Manage cohorts, activity, support requests, reports, and the wider fellowship experience." />
            </div>
          </div>
        </section>

        <section className="bg-white" id="about">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-bybs-rose">About Build Your Best Self</p>
                <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-bybs-navy sm:text-5xl">
                  A safe space for discovery, confidence, healing, and purpose.
                </h2>
              </div>
              <p className="text-base leading-8 text-bybs-body">
                Build Your Best Self is a personal growth and mentorship initiative helping young people discover who
                they are, heal from limiting patterns, build confidence, and become intentional about their future.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Pillar
                description="BYBS helps mentees dream again through fellowships, coaching, community programs, and personal development resources."
                icon={Target}
                title="Inspire"
              />
              <Pillar
                description="The fellowship creates spaces for reflection, honest conversations, reading challenges, and support through limiting patterns."
                icon={HeartHandshake}
                title="Heal"
              />
              <Pillar
                description="With guidance, structure, support, and community, mentees grow into more self-aware and purpose-driven individuals."
                icon={CheckCircle2}
                title="Evolve"
              />
            </div>
          </div>
        </section>

        <section className="border-y border-bybs-border bg-bybs-pale" id="why">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-bybs-blue">Why the BYBS LMS exists</p>
              <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-bybs-navy sm:text-5xl">
                Growth requires more than motivation. It requires structure.
              </h2>
              <p className="mt-4 text-base leading-8 text-bybs-body">
                As the fellowship grows, mentees need one place for materials, assignments, progress, discussions, and
                mentor connection. Mentors need a clearer way to support mentees, review submissions, share resources,
                manage sessions, and report development.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MethodStep
                description="Access learning materials, session slides, templates, recordings, announcements, and fellowship resources."
                icon={BookOpen}
                number="01"
                title="Access"
              />
              <MethodStep
                description="Submit assignments, follow deadlines, join discussions, and stay prepared throughout the fellowship."
                icon={ClipboardList}
                number="02"
                title="Participate"
              />
              <MethodStep
                description="Book one-on-one sessions, receive reminders, review feedback, and stay connected to mentor support."
                icon={MessageCircle}
                number="03"
                title="Connect"
              />
              <MethodStep
                description="Track progress, see reports, request support, and help the BYBS team identify where follow-up is needed."
                icon={TrendingUp}
                number="04"
                title="Grow"
              />
            </div>
          </div>
        </section>

        <section className="bg-white" id="portals">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-bybs-rose">Portal access</p>
                <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-bybs-navy sm:text-5xl">
                  Choose your BYBS workspace.
                </h2>
              </div>
              <Button as="a" className="w-full sm:w-auto" href="#cohort-4" icon={ArrowRight} variant="secondary">
                Cohort 4 onboarding
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <PortalCard
                action="Open mentee portal"
                description="Continue your BYBS learning journey, complete assignments, track progress, access resources, join discussions, and connect with mentors."
                href={studentLoginUrl}
                icon={GraduationCap}
                title="Mentee portal"
              />
              <PortalCard
                action="Open mentor portal"
                description="Support mentees, review assignments, upload resources, manage sessions, track growth, and share reports with the BYBS team."
                href={mentorLoginUrl}
                icon={UserRoundCheck}
                title="Mentor portal"
                tone="rose"
              />
            </div>
          </div>
        </section>

        <section className="border-y border-bybs-border bg-bybs-page">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-16">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-bybs-blue">Learning with accountability</p>
              <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-bybs-navy sm:text-5xl">
                A clear view of what is working, what is pending, and who needs support.
              </h2>
              <p className="mt-4 text-base leading-8 text-bybs-body">
                Assignments, deadlines, resources, mentor sessions, support requests, and progress updates become visible
                to the right people. That clarity helps mentees stay consistent and helps mentors follow up with care.
              </p>
            </div>
            <div className="grid gap-5 rounded-lg border border-bybs-border bg-white p-5 shadow-sm sm:p-6">
              <FeatureItem
                description="Mentees can keep their fellowship materials, tasks, progress, and support activity organized in one place."
                icon={GraduationCap}
                title="For mentees"
              />
              <FeatureItem
                description="Mentors can see mentee progress, review work, send reminders, upload session materials, and submit reports."
                icon={UserRoundCheck}
                title="For mentors"
              />
              <FeatureItem
                description="Admins can manage cohorts, users, assignments, resources, reports, support requests, and overall platform activity."
                icon={CalendarCheck}
                title="For the BYBS team"
              />
            </div>
          </div>
        </section>

        <section className="bg-white" id="cohort-4">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-bybs-rose">Cohort 4 onboarding</p>
                <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-bybs-navy sm:text-5xl">
                  The BYBS LMS is ready for the live fellowship experience.
                </h2>
                <p className="mt-4 text-base leading-8 text-bybs-body">
                  Cohort 4 mentees and mentors should use the portals below once their accounts have been created by the
                  BYBS team. New applicants and general visitors should continue through the main BYBS website.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Pillar
                  description="Use your account to access modules, resources, assignments, submissions, mentor booking, progress, certificates, support, and announcements."
                  icon={GraduationCap}
                  title="Cohort 4 mentees"
                />
                <Pillar
                  description="Use your mentor account to view assigned modules, upload session work, review submissions, track attendance, send reminders, and submit reports."
                  icon={UserRoundCheck}
                  title="Cohort 4 mentors"
                />
              </div>
            </div>
            <div className="mt-8 rounded-lg border border-bybs-border bg-bybs-pale p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div>
                <h3 className="text-lg font-bold text-bybs-navy">Already received your LMS login?</h3>
                <p className="mt-2 text-sm leading-6 text-bybs-body">
                  Choose the correct portal and sign in with the details sent by the BYBS team. For access issues, use
                  the support tools inside the platform or contact BYBS through the official website.
                </p>
              </div>
              <div className="mt-4 grid gap-2 sm:mt-0 sm:grid-cols-2">
                <Button as="a" className="w-full" href={studentLoginUrl} icon={GraduationCap}>
                  Mentee login
                </Button>
                <Button as="a" className="w-full" href={mentorLoginUrl} icon={UserRoundCheck} variant="secondary">
                  Mentor login
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-bybs-blush">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-bybs-rose">Need help or want to learn more?</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-normal text-bybs-navy">
                Visit the main BYBS website for the wider mission, programs, and community.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-bybs-body">
                If you are having trouble accessing your account, joining Cohort 4, or using the platform, contact the
                BYBS team through the official website.
              </p>
            </div>
            <Button as="a" className="w-full sm:w-auto" href={mainWebsiteUrl} icon={ArrowRight}>
              Visit BYBS Main Website
            </Button>
          </div>
        </section>
      </main>

      <footer className="bg-bybs-navy px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img alt={brandName} className="h-10 w-10 rounded-md bg-white object-contain p-1" src={logoSrc} />
            <div>
              <p className="text-sm font-bold">Build Your Best Self LMS</p>
              <p className="mt-1 text-sm text-white/70">Inspire, Heal, Evolve.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a className="text-white/80 hover:text-white" href={mainWebsiteUrl}>Main website</a>
            <a className="text-white/80 hover:text-white" href={studentLoginUrl}>Mentee login</a>
            <a className="text-white/80 hover:text-white" href={mentorLoginUrl}>Mentor login</a>
            <a className="text-white/80 hover:text-white" href="#cohort-4">Cohort 4</a>
          </div>
          <p className="text-sm text-white/70">Designed and maintained by TDAG.</p>
        </div>
      </footer>
    </div>
  );
}
