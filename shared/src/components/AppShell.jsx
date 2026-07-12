import { ArrowRight, Bell, Loader2, Menu, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  globalSearch,
  notificationCount = 0,
  notificationsHref,
  profileHref,
  searchPlaceholder = "Search",
  sidebarFooter
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchBoxRef = useRef(null);
  const currentYear = new Date().getFullYear();
  const roleLabel = user?.role ? ROLE_LABELS[user.role] || user.role : "Signed in";
  const visibleNotificationCount = Number(notificationCount || 0);

  useEffect(() => {
    if (!globalSearch) return undefined;

    const cleanQuery = searchQuery.trim();
    if (cleanQuery.length < 2) {
      setSearchResults([]);
      setSearchError("");
      setIsSearching(false);
      return undefined;
    }

    let isActive = true;
    setIsSearching(true);
    setSearchError("");

    const timer = window.setTimeout(() => {
      globalSearch(cleanQuery)
        .then((response) => {
          if (!isActive) return;
          setSearchResults(response?.data || []);
          setIsSearchOpen(true);
        })
        .catch((error) => {
          if (!isActive) return;
          setSearchResults([]);
          setSearchError(error.message || "Search failed");
          setIsSearchOpen(true);
        })
        .finally(() => {
          if (isActive) setIsSearching(false);
        });
    }, 250);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [globalSearch, searchQuery]);

  useEffect(() => {
    function handleClick(event) {
      if (!searchBoxRef.current?.contains(event.target)) {
        setIsSearchOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

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

  function submitSearch(event) {
    event.preventDefault();
    const firstResult = searchResults[0];

    if (firstResult?.href) {
      window.location.href = firstResult.href;
    }
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

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-72">
        <header className="fixed inset-x-0 top-0 z-40 border-b border-bybs-border bg-white/95 backdrop-blur lg:left-72">
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
              {globalSearch ? (
                <form
                  className="relative hidden min-w-80 md:block"
                  onSubmit={submitSearch}
                  ref={searchBoxRef}
                >
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-bybs-muted" aria-hidden="true" />
                  <input
                    aria-label={searchPlaceholder}
                    className="h-10 w-full rounded-md border border-bybs-border bg-white px-9 text-sm text-bybs-body outline-none transition placeholder:text-bybs-muted focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale"
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                  />
                  {searchQuery ? (
                    <button
                      aria-label="Clear search"
                      className="absolute right-3 top-2.5 text-bybs-muted transition hover:text-bybs-blue"
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults([]);
                        setSearchError("");
                      }}
                      type="button"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}

                  {isSearchOpen && searchQuery.trim().length >= 2 ? (
                    <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-lg border border-bybs-border bg-white shadow-lg">
                      <div className="max-h-80 overflow-y-auto p-2">
                        {isSearching ? (
                          <div className="flex items-center gap-2 px-3 py-3 text-sm text-bybs-muted">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Searching...
                          </div>
                        ) : searchError ? (
                          <p className="px-3 py-3 text-sm text-bybs-rose">{searchError}</p>
                        ) : searchResults.length ? (
                          searchResults.map((result) => (
                            <a
                              className="flex items-start justify-between gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-bybs-pale"
                              href={result.href}
                              key={`${result.type}-${result.id}`}
                              onClick={() => setIsSearchOpen(false)}
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-bybs-navy">{result.title}</span>
                                {result.description ? (
                                  <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-bybs-muted">{result.description}</span>
                                ) : null}
                                {result.type ? (
                                  <span className="mt-1 inline-flex rounded-md bg-bybs-pale px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-bybs-blue">
                                    {result.type}
                                  </span>
                                ) : null}
                              </span>
                              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-bybs-muted" aria-hidden="true" />
                            </a>
                          ))
                        ) : (
                          <p className="px-3 py-3 text-sm text-bybs-muted">No matching content found.</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </form>
              ) : (
                <div className="hidden min-w-80 items-center gap-2 rounded-md border border-bybs-border bg-white px-3 py-2 text-sm text-bybs-muted md:flex">
                  <Search className="h-4 w-4" aria-hidden="true" />
                  <span>Search</span>
                </div>
              )}
            </div>

            <div className="flex min-w-0 items-center gap-3">
              {notificationsHref ? (
                <span className="relative inline-flex">
                  <Button
                    aria-label={visibleNotificationCount ? `${visibleNotificationCount} unread notifications` : "Notifications"}
                    as="a"
                    href={notificationsHref}
                    size="icon"
                    title="Notifications"
                    variant="ghost"
                  >
                    <Bell className="h-5 w-5" aria-hidden="true" />
                  </Button>
                  {visibleNotificationCount ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-bybs-rose px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {visibleNotificationCount > 99 ? "99+" : visibleNotificationCount}
                    </span>
                  ) : null}
                </span>
              ) : null}
              <a
                aria-label="Open profile"
                className="flex min-w-0 items-center gap-3 rounded-md px-1 py-1 transition hover:bg-bybs-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bybs-pale"
                href={profileHref || "#"}
              >
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
                <div className="hidden min-w-0 text-right sm:block">
                  <p className="truncate text-sm font-medium text-bybs-navy">{user?.name || "BYBS User"}</p>
                  <p className="truncate text-xs text-bybs-muted">{roleLabel}</p>
                </div>
              </a>
            </div>
          </div>
        </header>

        <main className="min-w-0 max-w-full flex-1 overflow-x-hidden px-4 pb-6 pt-[5.5rem] sm:px-6 lg:px-8">{children}</main>
        <footer className="border-t border-bybs-border bg-white px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 text-sm text-bybs-muted sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; {currentYear} Build Your Best Self. Designed and maintained by <a href="https://thedigitalagame.com" target="_blank" rel="noopener noreferrer" className="font-medium text-bybs-blue hover:underline">TDAG</a>.</p>
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
