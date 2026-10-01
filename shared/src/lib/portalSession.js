export const SESSION_EXPIRED_EVENT = "bybs:session-expired";

export function safeInternalPath(value, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export function pathFromLocation(location, fallback = "/") {
  if (!location) return fallback;
  if (typeof location === "string") return safeInternalPath(location, fallback);

  const path = `${location.pathname || ""}${location.search || ""}${location.hash || ""}`;
  return safeInternalPath(path, fallback);
}

export function authReturnPath({ from, stored, fallback = "/" } = {}) {
  if (from) return pathFromLocation(from, fallback);
  return safeInternalPath(stored, fallback);
}

export function createPortalSessionStore({ portal, tokenKey, userKey, defaultPath = "/" }) {
  const noticeKey = `${tokenKey}:notice`;

  function getToken() {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(tokenKey);
  }

  function clearCredentials() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(tokenKey);
    window.localStorage.removeItem(userKey);
  }

  function getUser() {
    if (typeof window === "undefined") return null;
    const storedUser = window.localStorage.getItem(userKey);
    if (!storedUser) return null;

    try {
      return JSON.parse(storedUser);
    } catch {
      clearCredentials();
      return null;
    }
  }

  function save(token, user) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(tokenKey, token);
    window.localStorage.setItem(userKey, JSON.stringify(user));
    window.sessionStorage.removeItem(noticeKey);
  }

  function updateUser(user) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(userKey, JSON.stringify(user));
  }

  function clear() {
    if (typeof window === "undefined") return;
    clearCredentials();
    window.sessionStorage.removeItem(noticeKey);
  }

  function expire(token) {
    if (typeof window === "undefined") return null;
    const currentToken = getToken();

    if (!currentToken || (token && currentToken !== token)) {
      return null;
    }

    const currentPath = pathFromLocation(window.location, defaultPath);
    const isAuthPage = ["/login", "/forgot-password", "/reset-password"].includes(window.location.pathname);
    const notice = {
      message: "Your session has expired. Please sign in again.",
      returnTo: isAuthPage ? defaultPath : currentPath
    };

    clearCredentials();
    window.sessionStorage.setItem(noticeKey, JSON.stringify(notice));
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, {
      detail: { portal, notice }
    }));

    return notice;
  }

  function getNotice() {
    if (typeof window === "undefined") return null;
    const storedNotice = window.sessionStorage.getItem(noticeKey);
    if (!storedNotice) return null;

    try {
      return JSON.parse(storedNotice);
    } catch {
      return null;
    }
  }

  function dismissNotice() {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(noticeKey);
  }

  function consumeNotice() {
    const notice = getNotice();
    dismissNotice();
    return notice;
  }

  return {
    portal,
    getToken,
    getUser,
    save,
    updateUser,
    clear,
    expire,
    getNotice,
    dismissNotice,
    consumeNotice
  };
}
