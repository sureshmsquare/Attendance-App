import { request } from './api';
import { API_BASE_URL, ENDPOINTS } from '../constants/config';

/**
 * Authentication Service
 */
export const authService = {
  /**
   * Log in employee
   * @param {string} email
   * @param {string} password
   * @param {string} [customBaseUrl]
   */
  login: async (email, password, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.AUTH_LOGIN}`;

    return request(url, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  /**
   * Log out employee
   * @param {string} [token]
   * @param {string} [customBaseUrl]
   */
  logout: async (token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.AUTH_LOGOUT}`;

    try {
      return await request(url, {
        method: 'POST',
        token
      });
    } catch (error) {
      console.warn('[authService.logout] Backend notification failed:', error.message);
      // Client logout should proceed even if network fails
      return { ok: true, data: { success: true, message: 'Logged out locally' } };
    }
  },

  /**
   * Get current authenticated employee identity
   * @param {string} token
   * @param {string} [customBaseUrl]
   */
  getMe: async (token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.AUTH_ME}`;

    return request(url, {
      method: 'GET',
      token
    });
  }
};
