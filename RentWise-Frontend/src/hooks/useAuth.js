import { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

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
      role: decoded.role || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
    };
  } catch {
    localStorage.removeItem('token');
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    return getUserFromToken(token);
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem('token');
    return !!getUserFromToken(token);
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const u = getUserFromToken(token);
    setUser(u);
    setIsAuthenticated(!!u);
  }, []);

  const login = (token) => {
    localStorage.setItem('token', token);
    const u = getUserFromToken(token);
    setUser(u);
    setIsAuthenticated(!!u);
  };

  const updateUser = (token, extraUserData) => {
    if (token) {
      localStorage.setItem('token', token);
      const u = getUserFromToken(token);
      setUser(extraUserData ? { ...u, ...extraUserData } : u);
      setIsAuthenticated(true);
    } else if (extraUserData) {
      setUser((prev) => ({ ...prev, ...extraUserData }));
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  return { user, isAuthenticated, isLoading, login, logout, updateUser };
}