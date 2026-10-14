import { Platform, NativeModules } from 'react-native';

/**
 * Default LAN IP of development machine.
 * Active PC IPv4 Wi-Fi IP address.
 */
export const DEV_LAN_IP = '10.222.133.68';
export const API_PORT = 5000;

/**
 * Extract development server host IP from Metro scriptURL.
 * This dynamically adapts when PC IP changes or when connecting to Expo Go.
 */
export const getHostIp = () => {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      // scriptURL format: "http://10.221.168.68:8081/index.bundle?..."
      const host = scriptURL.split('://')[1]?.split('/')[0]?.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return host;
      }
    }
  } catch {
    // Ignore fallback
  }
  return DEV_LAN_IP || 'localhost';
};

/**
 * Automatically determine best base URL depending on platform & device:
 * - Web maps to localhost
 * - Physical mobile devices (Expo Go / Wi-Fi) connect via LAN IP or Metro host
 * - Android Emulator falls back to 10.0.2.2 if host is unreachable
 */
export const getDefaultApiUrl = () => {
  if (Platform.OS === 'web') {
    return `http://localhost:${API_PORT}/api/v1`;
  }

  const host = getHostIp();
  return `http://${host}:${API_PORT}/api/v1`;
};

export const API_BASE_URL = getDefaultApiUrl();

export const ENDPOINTS = {
  HEALTH: '/health',
  AUTH_LOGIN: '/auth/login',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_ME: '/auth/me',
  EMPLOYEES_ME: '/employees/me',
  ATTENDANCE_TODAY: '/attendance/today',
  ATTENDANCE_CHECK_IN: '/attendance/check-in',
  ATTENDANCE_CHECK_OUT: '/attendance/check-out',
  ATTENDANCE_HISTORY: '/attendance/history',
  ATTENDANCE_MONTHLY: '/attendance/monthly',
  ATTENDANCE_SUMMARY: '/attendance/summary',
  // Phase 5 Endpoints
  LEAVES: '/leaves',
  LEAVES_BALANCE: '/leaves/balance',
  LEAVES_TYPES: '/leaves/types',
  HALF_DAYS: '/half-days',
  PERMISSIONS: '/permissions',
  // Phase 6 Endpoints
  NOTIFICATIONS: '/notifications'
};
