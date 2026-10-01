import { SESSION_EXPIRED_EVENT } from "@bybs/shared";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, sessionStore } from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [{ token: initialToken, user: initialUser }] = useState(() => {
    const storedUser = sessionStore.getUser();
    return { token: storedUser ? sessionStore.getToken() : null, user: storedUser };
  });
  const [token, setToken] = useState(initialToken);
  const [user, setUser] = useState(initialUser);
  const [isCheckingSession, setIsCheckingSession] = useState(Boolean(initialToken && initialUser));
  const [sessionNotice, setSessionNotice] = useState(() => sessionStore.getNotice());

  function dismissSessionNotice() {
    sessionStore.dismissNotice();
    setSessionNotice(null);
  }

  useEffect(() => {
    function handleSessionExpired(event) {
      if (event.detail?.portal !== sessionStore.portal) return;
      setToken(null);
      setUser(null);
      setIsCheckingSession(false);
      setSessionNotice(event.detail.notice);
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  useEffect(() => {
    if (!token || !user) {
      setIsCheckingSession(false);
      return undefined;
    }

    let isActive = true;
    setIsCheckingSession(true);

    api.get("/auth/me")
      .then((response) => {
        if (!isActive) return;
        if (response.user?.role !== "mentor") {
          sessionStore.clear();
          setToken(null);
          setUser(null);
          return;
        }
        sessionStore.updateUser(response.user);
        setUser(response.user);
      })
      .catch(() => {})
      .finally(() => {
        if (isActive) setIsCheckingSession(false);
      });

    return () => {
      isActive = false;
    };
  }, [token]);

  async function login(credentials) {
    const response = await api.post("/auth/login", credentials, { skipUnauthorizedHandling: true });

    if (response.user?.role !== "mentor") {
      throw new Error("This portal is only for mentors.");
    }

    sessionStore.save(response.token, response.user);
    setToken(response.token);
    setUser(response.user);
    setSessionNotice(null);
    return response.user;
  }

  async function changePassword(payload) {
    const response = await api.post("/auth/change-password", payload);
    sessionStore.save(response.token, response.user);
    setToken(response.token);
    setUser(response.user);
    return response.user;
  }

  async function forgotPassword(email) {
    return api.post("/auth/forgot-password", { email, role: "mentor" });
  }

  async function resetPassword(payload) {
    return api.post("/auth/reset-password", payload);
  }

  async function updateProfile(payload) {
    const response = await api.patch("/auth/profile", payload);
    sessionStore.updateUser(response.user);
    setUser(response.user);
    return response.user;
  }

  async function uploadProfileImage(formData) {
    const response = await api.upload("/auth/profile-image", formData);
    sessionStore.updateUser(response.user);
    setUser(response.user);
    return response.user;
  }

  function logout() {
    sessionStore.clear();
    setToken(null);
    setUser(null);
    setSessionNotice(null);
  }

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token && user),
      isCheckingSession,
      sessionNotice,
      dismissSessionNotice,
      login,
      changePassword,
      forgotPassword,
      resetPassword,
      updateProfile,
      uploadProfileImage,
      logout,
      token,
      user
    }),
    [isCheckingSession, sessionNotice, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
