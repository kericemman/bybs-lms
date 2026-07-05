import { Bell, Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { ROLE_LABELS } from "../constants/roles.js";
import { cn } from "../lib/cn.js";
import { Button } from "./Button.jsx";

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "B") + (parts[1]?.[0] || "");
}

export function AppShell({
  portalName,
  navItems = [],
  activePath = "/",
  user,
  children,
  notificationsHref,
  sidebarFooter
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const roleLabel = user?.role ? ROLE_LABELS[user.role] || user.role : "Signed in";

  function renderNavLink(item, options = {}) {
    const Icon = item.icon;
    const isActive = item.href === activePath;

    return (
      <a
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
          isActive ? "bg-bybs-blue text-white" : "text-bybs-body hover:bg-bybs-pale hover:text-bybs-blue"
        )}
        href={item.href}
        key={item.href}
        onClick={() => setIsMenuOpen(false)}
        tabIndex={options.tabIndex}
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
        <span>{item.label}</span>
      </a>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-bybs-page text-bybs-text">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-bybs-border bg-white lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-bybs-border px-5 py-5">
            <p className="text-xs font-semibold uppercase text-bybs-blue">BYBS LMS</p>
            <h1 className="mt-1 text-lg font-semibold text-bybs-navy">{portalName}</h1>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navItems.map((item) => renderNavLink(item))}
          </nav>

          {sidebarFooter ? <div className="border-t border-bybs-border p-4">{sidebarFooter}</div> : null}
        </div>
      </aside>

      <div className="min-w-0 lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-bybs-border bg-white/95 backdrop-blur">
          <div className="flex h-16 min-w-0 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                aria-expanded={isMenuOpen}
                aria-label="Open menu"
                className="lg:hidden"
                onClick={() => setIsMenuOpen(true)}
                size="icon"
                title="Open menu"
                type="button"
                variant="ghost"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
              <div className="hidden min-w-80 items-center gap-2 rounded-md border border-bybs-border bg-white px-3 py-2 text-sm text-bybs-muted md:flex">
                <Search className="h-4 w-4" aria-hidden="true" />
                <span>Search</span>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-3">
              {notificationsHref ? (
                <Button
                  aria-label="Notifications"
                  as="a"
                  href={notificationsHref}
                  size="icon"
                  title="Notifications"
                  variant="ghost"
                >
                  <Bell className="h-5 w-5" aria-hidden="true" />
                </Button>
              ) : null}
              {user?.profileImage ? (
                <img
                  alt={user.name || "Profile"}
                  className="h-10 w-10 rounded-full border border-bybs-border object-cover"
                  src={user.profileImage}
                />
              ) : (
                <div className="hidden h-10 w-10 items-center justify-center rounded-full border border-bybs-border bg-bybs-pale text-sm font-semibold text-bybs-blue sm:flex">
                  {initials(user?.name || "BYBS User")}
                </div>
              )}
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-bybs-navy">{user?.name || "BYBS User"}</p>
                <p className="text-xs text-bybs-muted">{roleLabel}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 max-w-full overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        <footer className="border-t border-bybs-border bg-white px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 text-sm text-bybs-muted sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; {currentYear} Build Your Best Self. All rights reserved.</p>
            <p className="font-medium text-bybs-navy">{portalName}</p>
          </div>
        </footer>
      </div>

      <div
        aria-hidden={!isMenuOpen}
        className={cn(
          "fixed inset-0 z-[60] lg:hidden",
          isMenuOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <button
          aria-label="Close menu"
          className={cn(
            "absolute inset-0 bg-bybs-navy/40 transition-opacity",
            isMenuOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setIsMenuOpen(false)}
          tabIndex={isMenuOpen ? 0 : -1}
          type="button"
        />
        <aside
          aria-label={`${portalName} navigation`}
          className={cn(
            "relative flex h-full w-80 max-w-[88vw] flex-col border-r border-bybs-border bg-white shadow-xl transition-transform duration-200",
            isMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
          role="dialog"
        >
          <div className="flex items-center justify-between border-b border-bybs-border px-5 py-5">
            <div>
              <p className="text-xs font-semibold uppercase text-bybs-blue">BYBS LMS</p>
              <h2 className="mt-1 text-lg font-semibold text-bybs-navy">{portalName}</h2>
            </div>
            <Button
              aria-label="Close menu"
              onClick={() => setIsMenuOpen(false)}
              size="icon"
              tabIndex={isMenuOpen ? 0 : -1}
              title="Close menu"
              type="button"
              variant="ghost"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navItems.map((item) => renderNavLink(item, { tabIndex: isMenuOpen ? 0 : -1 }))}
          </nav>
          {sidebarFooter ? <div className="border-t border-bybs-border p-4">{sidebarFooter}</div> : null}
        </aside>
      </div>
    </div>
  );
}
