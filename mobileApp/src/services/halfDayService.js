import { request } from './api';
import { API_BASE_URL, ENDPOINTS } from '../constants/config';

/**
 * Mobile Half-Day Service for Phase 5
 */
export const halfDayService = {
  /**
   * Apply for half-day
   */
  applyHalfDay: async ({ requestDate, session, reason }, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.HALF_DAYS}`;
    return request(url, {
      method: 'POST',
      token,
      body: JSON.stringify({
        requestDate,
        session,
        reason
      })
    });
  },

  /**
   * Fetch employee's half-day requests
   */
  getHalfDayHistory: async (token, params = {}, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const queryParts = [];
    if (params.status) queryParts.push(`status=${encodeURIComponent(params.status)}`);
    if (params.page) queryParts.push(`page=${encodeURIComponent(params.page)}`);
    if (params.limit) queryParts.push(`limit=${encodeURIComponent(params.limit)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const url = `${baseUrl}${ENDPOINTS.HALF_DAYS}${queryString}`;
    return request(url, { method: 'GET', token });
  },

  /**
   * Fetch details of a half-day request
   */
  getHalfDayDetails: async (id, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.HALF_DAYS}/${id}`;
    return request(url, { method: 'GET', token });
  },

  /**
   * Cancel a pending half-day request
   */
  cancelHalfDay: async (id, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.HALF_DAYS}/${id}/cancel`;
    return request(url, { method: 'PATCH', token });
  }
};
