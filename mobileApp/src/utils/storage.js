import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'attendance_auth_token';
const EMPLOYEE_KEY = 'attendance_cached_employee';

// In-memory fallback if storage is unavailable
const memoryFallback = {};

/**
 * Save item securely using expo-secure-store
 */
export const setSecureItem = async (key, value) => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      } else {
        memoryFallback[key] = value;
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.warn(`[Storage] Failed to save key "${key}" securely:`, error.message);
    memoryFallback[key] = value;
  }
};

/**
 * Retrieve item securely using expo-secure-store
 */
export const getSecureItem = async (key) => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return memoryFallback[key] || null;
    }
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.warn(`[Storage] Failed to get key "${key}":`, error.message);
    return memoryFallback[key] || null;
  }
};

/**
 * Delete item securely
 */
export const deleteSecureItem = async (key) => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      delete memoryFallback[key];
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.warn(`[Storage] Failed to delete key "${key}":`, error.message);
    delete memoryFallback[key];
  }
};

// Convenience helpers
export const saveAuthToken = async (token) => setSecureItem(TOKEN_KEY, token);
export const getAuthToken = async () => getSecureItem(TOKEN_KEY);
export const removeAuthToken = async () => deleteSecureItem(TOKEN_KEY);

export const saveCachedEmployee = async (employee) => {
  return setSecureItem(EMPLOYEE_KEY, JSON.stringify(employee));
};

export const getCachedEmployee = async () => {
  const json = await getSecureItem(EMPLOYEE_KEY);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const removeCachedEmployee = async () => deleteSecureItem(EMPLOYEE_KEY);

export const clearAuthSession = async () => {
  await removeAuthToken();
  await removeCachedEmployee();
};
