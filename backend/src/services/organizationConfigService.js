const { pool } = require('../config/database');

let cachedConfig = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 30000; // 30 seconds cache

/**
 * Retrieve organization location, shift timings, and attendance configuration.
 * Reads from system_settings table with fallback to environment variables.
 * Values are NEVER hardcoded in controllers.
 */
const getOrganizationConfig = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cachedConfig && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const [rows] = await pool.query(`
      SELECT setting_key, setting_value 
      FROM system_settings 
      WHERE setting_key IN (
        'organization_latitude', 
        'organization_longitude', 
        'attendance_radius_meters',
        'organization_timezone',
        'organization_start_time',
        'organization_end_time'
      )
    `);

    const settingsMap = {};
    rows.forEach((row) => {
      settingsMap[row.setting_key] = row.setting_value;
    });

    const latitude = parseFloat(
      settingsMap.organization_latitude || process.env.ORGANIZATION_LATITUDE || '18.517222'
    );
    const longitude = parseFloat(
      settingsMap.organization_longitude || process.env.ORGANIZATION_LONGITUDE || '73.808722'
    );
    const radiusMeters = parseFloat(
      settingsMap.attendance_radius_meters || process.env.ATTENDANCE_RADIUS_METERS || '10'
    );
    const timezone =
      settingsMap.organization_timezone || process.env.TIMEZONE || 'Asia/Kolkata';

    const startTime =
      settingsMap.organization_start_time || process.env.ORGANIZATION_START_TIME || null;
    const endTime =
      settingsMap.organization_end_time || process.env.ORGANIZATION_END_TIME || null;

    cachedConfig = {
      latitude,
      longitude,
      radiusMeters,
      timezone,
      startTime,
      endTime,
      isConfigured: !isNaN(latitude) && !isNaN(longitude)
    };
    lastFetchTime = now;

    return cachedConfig;
  } catch (error) {
    console.error('[OrganizationConfigService Error]:', error.message);
    const latitude = parseFloat(process.env.ORGANIZATION_LATITUDE || '18.517222');
    const longitude = parseFloat(process.env.ORGANIZATION_LONGITUDE || '73.808722');
    const radiusMeters = parseFloat(process.env.ATTENDANCE_RADIUS_METERS || '10');
    const timezone = process.env.TIMEZONE || 'Asia/Kolkata';
    const startTime = process.env.ORGANIZATION_START_TIME || null;
    const endTime = process.env.ORGANIZATION_END_TIME || null;

    return {
      latitude,
      longitude,
      radiusMeters,
      timezone,
      startTime,
      endTime,
      isConfigured: !isNaN(latitude) && !isNaN(longitude)
    };
  }
};

module.exports = {
  getOrganizationConfig
};
