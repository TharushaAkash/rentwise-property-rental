import { useCallback, useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { queryClient } from '../services/queryClient';

import { AuthContext } from './authContext';

function getUserFromToken(token) {
  if (!token) return null;
  try {
    const decoded = jwtDecode(token);
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem('token');
      return null;
    }
    return {
      id: decoded.sub,
      email: decoded.email,
      fullName: decoded.FullName || decoded.name || decoded.unique_name || '',
      role: decoded.role || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
      phoneNumber: decoded.PhoneNumber || decoded.phoneNumber || '',
      nicNumber: decoded.NicNumber || decoded.nicNumber || ''
    };
  } catch {
    localStorage.removeItem('token');
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getUserFromToken(localStorage.getItem('token')));
  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    ['rentwise_saved_properties', 'rentwise_client_bookings', 'rentwise_client_agreements',
      'rentwise_client_payments', 'rentwise_client_maintenance', 'rentwise_client_users'].forEach(key => localStorage.removeItem(key));
    queryClient.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    const syncSession = () => {
      queryClient.clear();
      setUser(getUserFromToken(localStorage.getItem('token')));
    };
    const onStorage = event => { if (event.key === 'token' || event.key === null) syncSession(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('rentwise:session-expired', clearSession);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('rentwise:session-expired', clearSession);
    };
  }, [clearSession]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;
    const expiry = jwtDecode(token).exp;
    if (!expiry) return;
    const checkExpiry = () => { if (expiry * 1000 <= Date.now()) clearSession(); };
    const timer = setInterval(checkExpiry, 1000);
    return () => clearInterval(timer);
  }, [user, clearSession]);

  const login = useCallback(token => {
    const nextUser = getUserFromToken(token);
    if (!nextUser) return;
    queryClient.clear();
    localStorage.setItem('token', token);
    setUser(nextUser);
  }, []);
  const updateUser = useCallback((token, extraUserData) => {
    if (token) {
      const nextUser = getUserFromToken(token);
      if (!nextUser) { clearSession(); return; }
      localStorage.setItem('token', token);
      setUser({ ...nextUser, ...extraUserData });
    } else if (extraUserData) {
      setUser(previous => previous ? { ...previous, ...extraUserData } : null);
    }
  }, [clearSession]);
  const logout = useCallback(() => {
    clearSession();
    window.location.assign('/login');
  }, [clearSession]);

  return <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), isLoading: false, login, logout, updateUser }}>
    {children}
  </AuthContext.Provider>;
}
