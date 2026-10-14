/**
 * Production-grade formatting utilities for the employee mobile app.
 * All user-facing dates/times use readable formats.
 * No raw ISO strings, 24-hour times, or technical formats are exposed.
 */

/**
 * Format a time string (HH:mm:ss or HH:mm) into 12-hour format.
 * Input: "13:56:37" or "09:05" -> Output: "1:56 PM" or "9:05 AM"
 */
export const formatTime12h = (timeStr) => {
  if (!timeStr || timeStr === '--:--') return '--:--';
  try {
    const parts = timeStr.split(':');
    let hours = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(mins)) return timeStr;
    const suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${String(mins).padStart(2, '0')} ${suffix}`;
  } catch {
    return timeStr;
  }
};

/**
 * Format a date string (YYYY-MM-DD) into readable format.
 * Input: "2026-10-02" -> Output: "02 Oct 2026"
 */
export const formatDateReadable = (dateStr) => {
  if (!dateStr) return '';
  try {
    // Handle ISO strings with time component
    const datePart = dateStr.split('T')[0];
    const [y, m, d] = datePart.split('-').map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
  } catch {
    return dateStr;
  }
};

/**
 * Format a date string with day of week.
 * Input: "2026-10-02" -> Output: "Fri, 02 Oct 2026"
 */
export const formatDateWithDay = (dateStr) => {
  if (!dateStr) return '';
  try {
    const datePart = dateStr.split('T')[0];
    const [y, m, d] = datePart.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getUTCDay()]}, ${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
  } catch {
    return dateStr;
  }
};

/**
 * Format an ISO datetime string into a readable date and time.
 * Input: "2026-10-02T14:30:00.000Z" -> Output: "02 Oct 2026, 8:00 PM"
 */
export const formatDateTimeReadable = (isoStr) => {
  if (!isoStr) return '';
  try {
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return isoStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    let hours = date.getHours();
    const mins = date.getMinutes();
    const suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${String(d).padStart(2, '0')} ${months[m]} ${y}, ${hours}:${String(mins).padStart(2, '0')} ${suffix}`;
  } catch {
    return isoStr;
  }
};

/**
 * Format working minutes into readable duration.
 * Input: 515 -> Output: "8h 35m"
 * Input: 0 -> Output: "0h 00m"
 */
export const formatDuration = (minutes) => {
  if (minutes == null || isNaN(minutes)) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

/**
 * Format relative time for notifications.
 * Input: ISO date -> Output: "2 hours ago", "Yesterday", "3 days ago"
 */
export const formatRelativeTime = (isoStr) => {
  if (!isoStr) return '';
  try {
    const date = new Date(isoStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDateReadable(isoStr);
  } catch {
    return '';
  }
};

/**
 * Convert user-friendly error messages from technical API/network errors.
 */
export const friendlyErrorMessage = (error) => {
  if (!error) return 'Something went wrong. Please try again.';
  const msg = typeof error === 'string' ? error : (error.message || '');
  
  // Network errors
  if (msg.includes('ECONNREFUSED') || msg.includes('Network request failed') || msg.includes('fetch failed') || msg.includes('Fetch request has been canceled')) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
    return 'The request timed out. Please try again.';
  }
  // Auth errors
  if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('token') || msg.includes('jwt')) {
    return 'Your session has expired. Please log in again.';
  }
  // Rate limit
  if (msg.includes('429') || msg.includes('Too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  // Server errors
  if (msg.includes('500') || msg.includes('Internal Server') || msg.includes('SQL') || msg.includes('ECONNRESET')) {
    return 'Something went wrong on the server. Please try again later.';
  }
  // Return the original if it's already user-friendly
  return msg;
};
