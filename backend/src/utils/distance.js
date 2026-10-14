/**
 * Haversine Distance Calculation Utility
 * Calculates great-circle distance between two GPS coordinates in meters.
 */

const EARTH_RADIUS_METERS = 6371000; // Mean Earth radius in meters

/**
 * Converts degrees to radians
 * @param {number} degrees
 * @returns {number} radians
 */
const toRadians = (degrees) => {
  return (degrees * Math.PI) / 180;
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 Latitude of point 1
 * @param {number} lon1 Longitude of point 1
 * @param {number} lat2 Latitude of point 2
 * @param {number} lon2 Longitude of point 2
 * @returns {number} Distance in meters (rounded to 2 decimal places)
 */
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const numLat1 = parseFloat(lat1);
  const numLon1 = parseFloat(lon1);
  const numLat2 = parseFloat(lat2);
  const numLon2 = parseFloat(lon2);

  if (
    isNaN(numLat1) ||
    isNaN(numLon1) ||
    isNaN(numLat2) ||
    isNaN(numLon2)
  ) {
    throw new Error('Invalid coordinate parameters for Haversine distance calculation');
  }

  const phi1 = toRadians(numLat1);
  const phi2 = toRadians(numLat2);
  const deltaPhi = toRadians(numLat2 - numLat1);
  const deltaLambda = toRadians(numLon2 - numLon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_METERS * c;

  return Math.round(distance * 100) / 100;
};

/**
 * Validates if coordinates are valid numbers and within standard GPS ranges
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean}
 */
const isValidCoordinate = (lat, lon) => {
  const numLat = parseFloat(lat);
  const numLon = parseFloat(lon);

  if (isNaN(numLat) || isNaN(numLon)) {
    return false;
  }

  return numLat >= -90 && numLat <= 90 && numLon >= -180 && numLon <= 180;
};

module.exports = {
  calculateHaversineDistance,
  isValidCoordinate,
  EARTH_RADIUS_METERS
};
