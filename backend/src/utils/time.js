/**
 * Server-side Date and Time Utilities for Attendance
 * Default timezone: Asia/Kolkata (Indian Standard Time)
 */

const DEFAULT_TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata';

/**
 * Get current date string in YYYY-MM-DD format for configured timezone
 * @param {string} [timeZone]
 * @returns {string} e.g. "2026-10-02"
 */
const getTodayDateString = (timeZone = DEFAULT_TIMEZONE) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
};

/**
 * Get current time string in HH:mm:ss format for configured timezone
 * @param {string} [timeZone]
 * @returns {string} e.g. "09:35:12"
 */
const getCurrentTimeString = (timeZone = DEFAULT_TIMEZONE) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return formatter.format(new Date());
};

/**
 * Calculate working duration in minutes between check-in and check-out times
 * @param {string} checkInTimeStr e.g. "09:30:00"
 * @param {string} checkOutTimeStr e.g. "18:15:00"
 * @returns {number} duration in minutes
 */
const calculateWorkingMinutes = (checkInTimeStr, checkOutTimeStr) => {
  if (!checkInTimeStr || !checkOutTimeStr) return 0;

  const [inH, inM, inS = 0] = checkInTimeStr.split(':').map(Number);
  const [outH, outM, outS = 0] = checkOutTimeStr.split(':').map(Number);

  const inMinutes = inH * 60 + inM + Math.round(inS / 60);
  const outMinutes = outH * 60 + outM + Math.round(outS / 60);

  let diff = outMinutes - inMinutes;
  if (diff < 0) {
    diff += 24 * 60;
  }

  return Math.max(0, diff);
};

/**
 * Format working minutes into "Xh Ym" string
 * @param {number} minutes
 * @returns {string} e.g. "8h 45m"
 */
const formatWorkingDuration = (minutes) => {
  if (minutes == null || isNaN(minutes) || minutes < 0) return '0h 0m';
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m`;
};

/**
 * Determine if check-in is late compared to official shift start time
 * @param {string} checkInTime e.g. "09:45:00"
 * @param {string|null} startTime e.g. "09:30:00"
 * @returns {boolean|null} true if late, false if on time, null if threshold unconfigured
 */
const checkIsLate = (checkInTime, startTime) => {
  if (!checkInTime || !startTime) return null;
  return checkInTime > startTime;
};

/**
 * Determine if check-out is early compared to official shift end time
 * @param {string} checkOutTime e.g. "18:00:00"
 * @param {string|null} endTime e.g. "18:30:00"
 * @returns {boolean|null} true if early, false if full time, null if threshold unconfigured
 */
const checkIsEarlyCheckout = (checkOutTime, endTime) => {
  if (!checkOutTime || !endTime) return null;
  return checkOutTime < endTime;
};

/**
 * Validate YYYY-MM-DD date format
 * @param {string} dateString
 * @returns {boolean}
 */
const isValidDateFormat = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

module.exports = {
  getTodayDateString,
  getCurrentTimeString,
  calculateWorkingMinutes,
  formatWorkingDuration,
  checkIsLate,
  checkIsEarlyCheckout,
  isValidDateFormat,
  DEFAULT_TIMEZONE
};
