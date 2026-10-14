import { request } from './api';
import { API_BASE_URL, ENDPOINTS } from '../constants/config';

/**
 * Health check service to verify backend connection
 * @param {string} customBaseUrl - Optional custom URL for testing
 */
export const checkBackendHealth = async (customBaseUrl) => {
  const baseUrl = (customBaseUrl || API_BASE_URL).replace(/\/+$/, '');
  const endpoint = `${baseUrl}${ENDPOINTS.HEALTH}`;

  try {
    const result = await request(endpoint, { method: 'GET' });
    return {
      success: true,
      url: endpoint,
      data: result.data,
      statusCode: result.status,
    };
  } catch (error) {
    return {
      success: false,
      url: endpoint,
      error: error.message || 'Unable to connect to backend',
    };
  }
};
