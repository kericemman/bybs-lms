import { createContext, useContext, useMemo, useState } from "react";
import { api } from "../services/api.js";
import { ADMIN_PORTAL_ROLES } from "../utils/permissions.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => window.localStorage.getItem("bybs_admin_token"));
  const [user, setUser] = useState(() => {
    const stored = window.localStorage.getItem("bybs_admin_user");
    return stored ? JSON.parse(stored) : null;
  });

  async function login(credentials) {
    const response = await api.post("/auth/login", credentials);
    const role = response.user?.role;

    if (!ADMIN_PORTAL_ROLES.includes(role)) {
      throw new Error("This portal is only for admins.");
    }

    window.localStorage.setItem("bybs_admin_token", response.token);
    window.localStorage.setItem("bybs_admin_user", JSON.stringify(response.user));
    setToken(response.token);
    setUser(response.user);
    return response.user;
  }

  async function changePassword(payload) {
    const response = await api.post("/auth/change-password", payload);
    window.localStorage.setItem("bybs_admin_user", JSON.stringify(response.user));
    setUser(response.user);
    return response.user;
  }

  async function updateProfile(payload) {
    const response = await api.patch("/auth/profile", payload);
    window.localStorage.setItem("bybs_admin_user", JSON.stringify(response.user));
    setUser(response.user);
    return response.user;
  }

  async function uploadProfileImage(formData) {
    const response = await api.upload("/auth/profile-image", formData);
    window.localStorage.setItem("bybs_admin_user", JSON.stringify(response.user));
    setUser(response.user);
    return response.user;
  }

  function logout() {
    window.localStorage.removeItem("bybs_admin_token");
    window.localStorage.removeItem("bybs_admin_user");
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token),
      login,
      changePassword,
      updateProfile,
      uploadProfileImage,
      logout,
      token,
      user
    }),
    [token, user]
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
