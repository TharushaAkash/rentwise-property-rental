import { jwtDecode } from 'jwt-decode';

export function accountCacheKey(key) {
  try {
    const claims = jwtDecode(localStorage.getItem('token'));
    if (claims.exp && claims.exp * 1000 <= Date.now()) return null;
    const account = claims.email?.trim().toLowerCase() || claims.sub;
    return account ? `${key}:${encodeURIComponent(account)}` : null;
  } catch {
    return null;
  }
}

// Unscoped legacy entries have no trustworthy account attribution.
export const accountStorage = {
  getItem(key) {
    const scoped = accountCacheKey(key);
    return scoped ? localStorage.getItem(scoped) : null;
  },
  setItem(key, value) {
    const scoped = accountCacheKey(key);
    if (scoped) localStorage.setItem(scoped, value);
  },
  removeItem(key) {
    const scoped = accountCacheKey(key);
    if (scoped) localStorage.removeItem(scoped);
  },
};

export function belongsToAccount(record, user) {
  if (!record || !user?.id) return false;
  if (['Admin', 'Administrator', 'SystemAdmin'].includes(user.role)) return true;
  return record.tenantId === user.id || record.ownerId === user.id || record.property?.ownerId === user.id;
}
