import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api-client/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('ottv2_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current user if token exists
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const userData = await apiClient.get('/auth/me');
        setUser(userData);
      } catch {
        // Token expired or invalid
        localStorage.removeItem('ottv2_token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const res = await apiClient.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    localStorage.setItem('ottv2_token', res.access_token);
    setToken(res.access_token);

    const userData = await apiClient.get('/auth/me', {
      headers: { Authorization: `Bearer ${res.access_token}` },
    });
    setUser(userData);
    return userData;
  };

  const register = async (name, email, password) => {
    await apiClient.post('/auth/register', { name, email, password });
    return login(email, password);
  };

  const logout = () => {
    localStorage.removeItem('ottv2_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
