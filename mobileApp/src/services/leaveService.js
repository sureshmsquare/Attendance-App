import { request } from './api';
import { API_BASE_URL, ENDPOINTS } from '../constants/config';

/**
 * Mobile Leave Service for Phase 5
 */
export const leaveService = {
  /**
   * Fetch active leave types for selection
   */
  getLeaveTypes: async (token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.LEAVES_TYPES}`;
    return request(url, { method: 'GET', token });
  },

  /**
   * Fetch employee leave balances for a specific year
   */
  getLeaveBalances: async (token, year, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const query = year ? `?year=${year}` : '';
    const url = `${baseUrl}${ENDPOINTS.LEAVES_BALANCE}${query}`;
    return request(url, { method: 'GET', token });
  },

  /**
   * Apply for leave
   */
  applyLeave: async ({ leaveTypeId, fromDate, toDate, reason }, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.LEAVES}`;
    return request(url, {
      method: 'POST',
      token,
      body: JSON.stringify({
        leaveTypeId,
        fromDate,
        toDate,
        reason
      })
    });
  },

  /**
   * Fetch employee's leave request history with pagination/filters
   */
  getLeaveHistory: async (token, params = {}, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const queryParts = [];
    if (params.status) queryParts.push(`status=${encodeURIComponent(params.status)}`);
    if (params.year) queryParts.push(`year=${encodeURIComponent(params.year)}`);
    if (params.page) queryParts.push(`page=${encodeURIComponent(params.page)}`);
    if (params.limit) queryParts.push(`limit=${encodeURIComponent(params.limit)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const url = `${baseUrl}${ENDPOINTS.LEAVES}${queryString}`;
    return request(url, { method: 'GET', token });
  },

  /**
   * Fetch details of a single leave request
   */
  getLeaveDetails: async (id, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.LEAVES}/${id}`;
    return request(url, { method: 'GET', token });
  },

  /**
   * Cancel an eligible pending leave request
   */
  cancelLeave: async (id, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.LEAVES}/${id}/cancel`;
    return request(url, { method: 'PATCH', token });
  }
};
