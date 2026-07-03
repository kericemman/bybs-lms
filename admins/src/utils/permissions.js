export const ADMIN_PORTAL_ROLES = ["admin", "adminManager", "superAdmin"];
export const ADMIN_MANAGER_ROLE = "adminManager";
export const SUPER_ADMIN_ROLE = "superAdmin";

export function hasRole(user, roles = []) {
  return roles.includes(user?.role);
}

export function canDeleteOperationalRecords(user) {
  return hasRole(user, ["admin", "superAdmin"]);
}

export function canManageAdminManagers(user) {
  return user?.role === SUPER_ADMIN_ROLE;
}

export function canAccessSystemArea(user) {
  return hasRole(user, ["admin", "superAdmin"]);
}
