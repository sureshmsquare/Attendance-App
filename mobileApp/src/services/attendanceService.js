import { request } from './api';
import { API_BASE_URL, ENDPOINTS } from '../constants/config';

/**
 * Attendance Service
 * Handles Phase 3 GPS attendance and Phase 4 History & Reports
 */
export const attendanceService = {
  /**
   * Fetch today's attendance record for authenticated employee
   * @param {string} token
   * @param {string} [customBaseUrl]
   */
  getTodayAttendance: async (token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.ATTENDANCE_TODAY}`;

    return request(url, {
      method: 'GET',
      token
    });
  },

  /**
   * Mark employee check-in with GPS coordinates
   * @param {object} coords { latitude, longitude, accuracy }
   * @param {string} token
   * @param {string} [customBaseUrl]
   */
  checkIn: async ({ latitude, longitude, accuracy, isMocked }, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.ATTENDANCE_CHECK_IN}`;

    return request(url, {
      method: 'POST',
      token,
      body: JSON.stringify({
        latitude,
        longitude,
        accuracy,
        isMocked
      })
    });
  },

  /**
   * Mark employee check-out with GPS coordinates
   * @param {object} coords { latitude, longitude, accuracy, isMocked }
   * @param {string} token
   * @param {string} [customBaseUrl]
   */
  checkOut: async ({ latitude, longitude, accuracy, isMocked }, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}${ENDPOINTS.ATTENDANCE_CHECK_OUT}`;

    return request(url, {
      method: 'POST',
      token,
      body: JSON.stringify({
        latitude,
        longitude,
        accuracy,
        isMocked
      })
    });
  },

  /**
   * Fetch attendance history with optional filters and pagination
   * @param {object} filters { fromDate, toDate, status, page, limit }
   * @param {string} token
   * @param {string} [customBaseUrl]
   */
  getAttendanceHistory: async (filters = {}, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const queryParams = new URLSearchParams();

    if (filters.fromDate) queryParams.append('fromDate', filters.fromDate);
    if (filters.toDate) queryParams.append('toDate', filters.toDate);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.page) queryParams.append('page', String(filters.page));
    if (filters.limit) queryParams.append('limit', String(filters.limit));

    const queryString = queryParams.toString();
    const url = `${baseUrl}${ENDPOINTS.ATTENDANCE_HISTORY}${queryString ? `?${queryString}` : ''}`;

    return request(url, {
      method: 'GET',
      token
    });
  },

  /**
   * Fetch monthly attendance records and summary
   * @param {object} params { year, month }
   * @param {string} token
   * @param {string} [customBaseUrl]
   */
  getMonthlyAttendance: async ({ year, month } = {}, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const queryParams = new URLSearchParams();

    if (year) queryParams.append('year', String(year));
    if (month) queryParams.append('month', String(month));

    const queryString = queryParams.toString();
    const url = `${baseUrl}${ENDPOINTS.ATTENDANCE_MONTHLY}${queryString ? `?${queryString}` : ''}`;

    return request(url, {
      method: 'GET',
      token
    });
  },

  /**
   * Fetch attendance summary statistics
   * @param {object} filters { fromDate, toDate }
   * @param {string} token
   * @param {string} [customBaseUrl]
   */
  getAttendanceSummary: async (filters = {}, token, customBaseUrl) => {
    const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
    const queryParams = new URLSearchParams();

    if (filters.fromDate) queryParams.append('fromDate', filters.fromDate);
    if (filters.toDate) queryParams.append('toDate', filters.toDate);

    const queryString = queryParams.toString();
    const url = `${baseUrl}${ENDPOINTS.ATTENDANCE_SUMMARY}${queryString ? `?${queryString}` : ''}`;

    return request(url, {
      method: 'GET',
      token
    });
  }
};
