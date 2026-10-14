import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  saveAuthToken,
  getAuthToken,
  saveCachedEmployee,
  getCachedEmployee,
  clearAuthSession
} from '../utils/storage';
import { authService } from '../services/authService';
import { employeeService } from '../services/employeeService';
import { API_BASE_URL } from '../constants/config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiUrl, setApiUrl] = useState(API_BASE_URL);

  // Restore authenticated session on application launch
  const restoreSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedToken = await getAuthToken();
      const cachedEmp = await getCachedEmployee();

      if (storedToken) {
        setToken(storedToken);
        if (cachedEmp) {
          setEmployee(cachedEmp);
        }

        // Validate token and fetch latest profile from backend
        try {
          const profileRes = await employeeService.getProfile(storedToken, apiUrl);
          if (profileRes.ok && profileRes.data?.data?.employee) {
            const freshEmployee = profileRes.data.data.employee;
            setEmployee(freshEmployee);
            await saveCachedEmployee(freshEmployee);
          }
        } catch (fetchErr) {
          // If token is invalid or expired (401), clear session
          if (fetchErr.status === 401) {
            console.warn('[AuthContext] Stored token expired or invalid. Clearing session.');
            await clearAuthSession();
            setToken(null);
            setEmployee(null);
          } else {
            console.warn('[AuthContext] Network issue verifying token, using cached session:', fetchErr.message);
          }
        }
      }
    } catch (err) {
      console.error('[AuthContext] Error restoring session:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  /**
   * Log in with credentials
   */
  const login = async (email, password) => {
    const res = await authService.login(email, password, apiUrl);
    if (res.ok && res.data?.data) {
      const { token: receivedToken, employee: receivedEmployee } = res.data.data;
      setToken(receivedToken);
      setEmployee(receivedEmployee);

      await saveAuthToken(receivedToken);
      await saveCachedEmployee(receivedEmployee);
      return { success: true, employee: receivedEmployee };
    }
    throw new Error(res.data?.message || 'Login failed');
  };

  /**
   * Log out employee
   */
  const logout = async () => {
    try {
      if (token) {
        await authService.logout(token, apiUrl);
      }
    } catch (err) {
      console.warn('[AuthContext] Remote logout warning:', err.message);
    } finally {
      await clearAuthSession();
      setToken(null);
      setEmployee(null);
    }
  };

  /**
   * Refresh authenticated employee profile
   */
  const refreshProfile = async () => {
    if (!token) return;
    try {
      const res = await employeeService.getProfile(token, apiUrl);
      if (res.ok && res.data?.data?.employee) {
        const fresh = res.data.data.employee;
        setEmployee(fresh);
        await saveCachedEmployee(fresh);
        return fresh;
      }
    } catch (error) {
      if (error.status === 401) {
        await logout();
      }
      throw error;
    }
  };

  /**
   * Update allowed profile details
   */
  const updateProfile = async (updateData) => {
    if (!token) throw new Error('Not authenticated');
    const res = await employeeService.updateProfile(updateData, token, apiUrl);
    if (res.ok && res.data?.data?.employee) {
      const updated = res.data.data.employee;
      setEmployee(updated);
      await saveCachedEmployee(updated);
      return updated;
    }
    throw new Error(res.data?.message || 'Failed to update profile');
  };

  const value = {
    token,
    employee,
    isLoading,
    isAuthenticated: Boolean(token && employee),
    apiUrl,
    setApiUrl,
    login,
    logout,
    refreshProfile,
    updateProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
