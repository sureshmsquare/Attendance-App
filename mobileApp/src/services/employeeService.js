import { request } from './api';
import { API_BASE_URL, ENDPOINTS } from '../constants/config';

/**
 * Employee Profile Service
 */
export const employeeService = {
  /**
   * Fetch current authenticated employee's full profile
   * @param {string} token
   * @param {string} [customBaseUrl]
   */
  getProfile: async (token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.EMPLOYEES_ME}`;

    return request(url, {
      method: 'GET',
      token
    });
  },

  /**
   * Update allowed profile fields (first_name, last_name, phone, profile_image)
   * @param {object} updateData
   * @param {string} token
   * @param {string} [customBaseUrl]
   */
  updateProfile: async (updateData, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.EMPLOYEES_ME}`;

    return request(url, {
      method: 'PUT',
      token,
      body: JSON.stringify(updateData)
    });
  }
};
