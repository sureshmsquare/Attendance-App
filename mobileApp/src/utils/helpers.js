/**
 * Format ISO date string into readable local date and time
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch (error) {
    return dateString;
  }
};

/**
 * Truncate text with ellipsis if length exceeds max
 */
export const truncate = (str, maxLength = 30) => {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
};
