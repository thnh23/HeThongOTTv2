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

  const reloadUser = async () => {
    if (!token) return null;
    try {
      const userData = await apiClient.get('/auth/me');
      setUser(userData);
      return userData;
    } catch {
      return null;
    }
  };

  const updateProfile = async (profileData) => {
    const updated = await apiClient.put('/auth/profile', profileData);
    setUser(updated);
    return updated;
  };

  const changePassword = async (oldPassword, newPassword) => {
    return await apiClient.post('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
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
        logout,
        reloadUser,
        updateProfile,
        changePassword,
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
