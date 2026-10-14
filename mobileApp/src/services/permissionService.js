import { request } from './api';
import { API_BASE_URL, ENDPOINTS } from '../constants/config';

/**
 * Mobile Permission Service for Phase 5
 */
export const permissionService = {
  /**
   * Apply for short permission
   */
  applyPermission: async ({ permissionDate, fromTime, toTime, reason }, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.PERMISSIONS}`;
    return request(url, {
      method: 'POST',
      token,
      body: JSON.stringify({
        permissionDate,
        fromTime,
        toTime,
        reason
      })
    });
  },

  /**
   * Fetch employee's permission requests
   */
  getPermissionHistory: async (token, params = {}, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const queryParts = [];
    if (params.status) queryParts.push(`status=${encodeURIComponent(params.status)}`);
    if (params.page) queryParts.push(`page=${encodeURIComponent(params.page)}`);
    if (params.limit) queryParts.push(`limit=${encodeURIComponent(params.limit)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const url = `${baseUrl}${ENDPOINTS.PERMISSIONS}${queryString}`;
    return request(url, { method: 'GET', token });
  },

  /**
   * Fetch details of a permission request
   */
  getPermissionDetails: async (id, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.PERMISSIONS}/${id}`;
    return request(url, { method: 'GET', token });
  },

  /**
   * Cancel a pending permission request
   */
  cancelPermission: async (id, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.PERMISSIONS}/${id}/cancel`;
    return request(url, { method: 'PATCH', token });
  }
};
