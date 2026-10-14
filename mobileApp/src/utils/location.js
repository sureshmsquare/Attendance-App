import * as Location from 'expo-location';

/**
 * Request foreground GPS permission
 */
export const requestLocationPermission = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return {
      granted: status === 'granted',
      status
    };
  } catch (error) {
    console.warn('[Location] Permission request failed:', error.message);
    return {
      granted: false,
      error: error.message || 'Unable to request location permissions'
    };
  }
};

/**
 * Fetch current GPS location coordinates and accuracy
 */
export const getCurrentGpsLocation = async () => {
  try {
    const isServiceEnabled = await Location.hasServicesEnabledAsync();
    if (!isServiceEnabled) {
      throw new Error('GPS / Location services are disabled. Please enable location on your device.');
    }

    const permission = await requestLocationPermission();
    if (!permission.granted) {
      throw new Error('Location permission is required to mark attendance.');
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      timeInterval: 5000
    });

    const isMocked = Boolean(location.mocked || location.coords?.isMocked);

    return {
      success: true,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ? Math.round(location.coords.accuracy * 10) / 10 : null,
      isMocked,
      timestamp: location.timestamp
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unable to acquire GPS location'
    };
  }
};

/**
 * Client-side Haversine helper for UI guidance and preview
 * (Backend remains the authoritative validation check!)
 */
export const calculateClientDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;

  const R = 6371000; // meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};
