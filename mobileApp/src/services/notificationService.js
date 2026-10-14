import { request } from './api';
import { API_BASE_URL, ENDPOINTS } from '../constants/config';

/**
 * Mobile Notification Service for Phase 6
 */
export const notificationService = {
  /**
   * Fetch employee's notifications with optional pagination and filters
   */
  getNotifications: async (token, params = {}, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const queryParts = [];
    if (params.page) queryParts.push(`page=${encodeURIComponent(params.page)}`);
    if (params.limit) queryParts.push(`limit=${encodeURIComponent(params.limit)}`);
    if (params.is_read !== undefined && params.is_read !== null) {
      queryParts.push(`is_read=${encodeURIComponent(params.is_read)}`);
    }
    if (params.type) queryParts.push(`type=${encodeURIComponent(params.type)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const url = `${baseUrl}${ENDPOINTS.NOTIFICATIONS}${queryString}`;
    return request(url, { method: 'GET', token });
  },

  /**
   * Fetch unread notifications count
   */
  getUnreadCount: async (token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.NOTIFICATIONS}/unread-count`;
    return request(url, { method: 'GET', token });
  },

  /**
   * Mark a specific notification as read
   */
  markAsRead: async (id, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.NOTIFICATIONS}/${id}/read`;
    return request(url, { method: 'PATCH', token });
  },

  /**
   * Mark all employee notifications as read
   */
  markAllAsRead: async (token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.NOTIFICATIONS}/read-all`;
    return request(url, { method: 'PATCH', token });
  }
};
