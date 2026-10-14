import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Platform,
  AppState
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { attendanceService } from '../services/attendanceService';
import {
  getCurrentGpsLocation,
  calculateClientDistance,
  requestLocationPermission
} from '../utils/location';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { formatTime12h, formatDateReadable, formatDuration, friendlyErrorMessage } from '../utils/formatters';

export const AttendanceScreen = () => {
  const { token, apiUrl, employee } = useAuth();

  // Attendance state
  const [attendance, setAttendance] = useState(null);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [organization, setOrganization] = useState(null);
  const [todayDate, setTodayDate] = useState('');

  // Location state
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  // Load today's attendance
  const loadTodayAttendance = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingAttendance(true);
      const res = await attendanceService.getTodayAttendance(token, apiUrl);
      if (res.ok && res.data?.data) {
        setAttendance(res.data.data.attendance);
        setOrganization(res.data.data.organization);
        setTodayDate(res.data.data.todayDate);
        setStatusMessage(null);
      }
    } catch (err) {
      console.warn('[AttendanceScreen] Load today attendance error:', err.message);
      setStatusMessage({
        type: 'error',
        text: friendlyErrorMessage(err)
      });
    } finally {
      setLoadingAttendance(false);
      setRefreshing(false);
    }
  }, [token, apiUrl]);

  // Acquire GPS location
  const refreshLocation = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const loc = await getCurrentGpsLocation();
      if (loc.success) {
        setLocation(loc);
        setLocationError(null);
      } else {
        setLocationError(loc.error);
      }
    } catch (err) {
      setLocationError(err.message || 'Unable to get your current location. Please turn on Location Services and try again.');
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    loadTodayAttendance();
    refreshLocation();

    // Re-check attendance status whenever app returns to foreground
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        loadTodayAttendance();
        refreshLocation();
      }
    });

    return () => {
      appStateSub?.remove();
    };
  }, [loadTodayAttendance, refreshLocation]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTodayAttendance();
    refreshLocation();
  };

  // Current coordinates from real GPS
  const activeLatitude = location?.latitude;
  const activeLongitude = location?.longitude;
  const activeAccuracy = location?.accuracy;
  const activeIsMocked = Boolean(location?.isMocked);

  // Calculate distance to organization
  const currentDistance =
    organization && activeLatitude != null && activeLongitude != null
      ? calculateClientDistance(
          activeLatitude,
          activeLongitude,
          organization.latitude,
          organization.longitude
        )
      : null;

  const isWithinRadius =
    currentDistance != null &&
    organization?.radiusMeters != null &&
    currentDistance <= organization.radiusMeters;

  // Check In Handler
  const handleCheckIn = async () => {
    if (activeLatitude == null || activeLongitude == null) {
      setStatusMessage({
        type: 'error',
        text: 'Unable to get your current location. Please turn on Location Services and try again.'
      });
      return;
    }

    setActionLoading(true);
    setStatusMessage(null);

    try {
      const res = await attendanceService.checkIn(
        {
          latitude: activeLatitude,
          longitude: activeLongitude,
          accuracy: activeAccuracy,
          isMocked: activeIsMocked
        },
        token,
        apiUrl
      );

      if (res.ok && res.data?.data?.attendance) {
        setAttendance(res.data.data.attendance);
        const time = formatTime12h(res.data.data.attendance.check_in_time);
        setStatusMessage({
          type: 'success',
          text: `Attendance marked at ${time}`
        });
        // Refresh today's record to ensure synced state
        loadTodayAttendance();
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('mock') || msg.includes('Mock')) {
        setStatusMessage({ type: 'error', text: 'Mock location detected. Attendance cannot be recorded.' });
      } else if (msg.includes('accuracy') || msg.includes('Accuracy')) {
        setStatusMessage({ type: 'error', text: 'GPS accuracy is too low. Please move to an open area and try again.' });
      } else if (msg.includes('radius') || msg.includes('outside') || msg.includes('within')) {
        setStatusMessage({ type: 'error', text: 'You are outside the allowed office area. Please move closer and try again.' });
      } else {
        setStatusMessage({ type: 'error', text: friendlyErrorMessage(err) });
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Check Out Handler
  const handleCheckOut = async () => {
    if (activeLatitude == null || activeLongitude == null) {
      setStatusMessage({
        type: 'error',
        text: 'Unable to get your current location. Please turn on Location Services and try again.'
      });
      return;
    }

    setActionLoading(true);
    setStatusMessage(null);

    try {
      const res = await attendanceService.checkOut(
        {
          latitude: activeLatitude,
          longitude: activeLongitude,
          accuracy: activeAccuracy,
          isMocked: activeIsMocked
        },
        token,
        apiUrl
      );

      if (res.ok && res.data?.data?.attendance) {
        setAttendance(res.data.data.attendance);
        const mins = res.data.data.workingMinutes || 0;
        setStatusMessage({
          type: 'success',
          text: `Out marked. Working time: ${formatDuration(mins)}`
        });
        // Refresh today's record to ensure synced state
        loadTodayAttendance();
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('mock') || msg.includes('Mock')) {
        setStatusMessage({ type: 'error', text: 'Mock location detected. Attendance cannot be recorded.' });
      } else if (msg.includes('accuracy') || msg.includes('Accuracy')) {
        setStatusMessage({ type: 'error', text: 'GPS accuracy is too low. Please move to an open area and try again.' });
      } else if (msg.includes('radius') || msg.includes('outside') || msg.includes('within')) {
        setStatusMessage({ type: 'error', text: 'You are outside the allowed office area. Please move closer and try again.' });
      } else {
        setStatusMessage({ type: 'error', text: friendlyErrorMessage(err) });
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Format status - only consider attendance active for today
  const effectiveTodayDate = todayDate || new Date().toISOString().split('T')[0];
  const isTodayRecord = Boolean(
    attendance &&
    attendance.attendance_date === effectiveTodayDate
  );

  const isCheckedIn = isTodayRecord;
  const isCheckedOut = Boolean(isTodayRecord && attendance.check_out_time);

  let statusLabel = 'Not Marked';
  let statusBg = COLORS.badgeError;
  let statusTextColor = COLORS.badgeErrorText;
  let statusIcon = 'x-circle';

  if (isCheckedOut) {
    statusLabel = 'Attendance Completed';
    statusBg = COLORS.badgeSuccess;
    statusTextColor = COLORS.badgeSuccessText;
    statusIcon = 'check-circle';
  } else if (isCheckedIn) {
    statusLabel = 'Checked In';
    statusBg = COLORS.primaryLight;
    statusTextColor = COLORS.primary;
    statusIcon = 'clock';
  }

  // Working duration display
  const workingMinutes = attendance?.working_minutes;
  const workingDisplay = formatDuration(workingMinutes);

  // Friendly location message
  const getLocationMessage = () => {
    if (locationError) {
      if (locationError.includes('permission')) return 'Location permission required. Please enable location access in your device settings.';
      return 'Unable to get your current location. Please turn on Location Services and try again.';
    }
    if (activeLatitude == null) return 'Acquiring your location...';
    if (isWithinRadius) return 'Your location is verified.';
    if (currentDistance != null) return 'You are outside the allowed office area.';
    return 'Checking location...';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Attendance</Text>
          <Text style={styles.subtitle}>
            {todayDate ? formatDateReadable(todayDate) : "Today's Attendance"}
          </Text>
        </View>

        {/* Status Message Banner */}
        {statusMessage && (
          <View
            style={[
              styles.messageBanner,
              {
                backgroundColor:
                  statusMessage.type === 'success'
                    ? COLORS.badgeSuccess
                    : COLORS.badgeError
              }
            ]}
          >
            <Feather
              name={statusMessage.type === 'success' ? 'check-circle' : 'alert-circle'}
              size={16}
              color={statusMessage.type === 'success' ? COLORS.badgeSuccessText : COLORS.badgeErrorText}
            />
            <Text
              style={[
                styles.messageText,
                {
                  color:
                    statusMessage.type === 'success'
                      ? COLORS.badgeSuccessText
                      : COLORS.badgeErrorText
                }
              ]}
            >
              {statusMessage.text}
            </Text>
          </View>
        )}

        {/* Today's Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Feather name="calendar" size={16} color={COLORS.secondary} />
              <Text style={styles.cardTitle}>Today's Status</Text>
            </View>
            {loadingAttendance ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                <Feather name={statusIcon} size={12} color={statusTextColor} />
                <Text style={[styles.statusPillText, { color: statusTextColor }]}>
                  {statusLabel}
                </Text>
              </View>
            )}
          </View>

          {/* Time Grid */}
          <View style={styles.timeGrid}>
            <View style={styles.timeBlock}>
              <Feather name="log-in" size={16} color={COLORS.accent} />
              <Text style={styles.timeBlockLabel}>IN</Text>
              <Text style={styles.timeBlockVal}>
                {isTodayRecord && attendance?.check_in_time ? formatTime12h(attendance.check_in_time) : '--:--'}
              </Text>
            </View>

            <View style={styles.timeBlockDivider} />

            <View style={styles.timeBlock}>
              <Feather name="log-out" size={16} color={COLORS.danger} />
              <Text style={styles.timeBlockLabel}>OUT</Text>
              <Text style={styles.timeBlockVal}>
                {isTodayRecord && attendance?.check_out_time
                  ? formatTime12h(attendance.check_out_time)
                  : isCheckedIn
                  ? 'Not marked'
                  : '--:--'}
              </Text>
            </View>

            <View style={styles.timeBlockDivider} />

            <View style={styles.timeBlock}>
              <Feather name="clock" size={16} color={COLORS.primary} />
              <Text style={styles.timeBlockLabel}>Working Time</Text>
              <Text style={[styles.timeBlockVal, { color: COLORS.primary }]}>
                {isTodayRecord && workingDisplay ? workingDisplay : '--'}
              </Text>
            </View>
          </View>
        </View>

        {/* Location Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Feather name="map-pin" size={16} color={COLORS.secondary} />
              <Text style={styles.cardTitle}>Location Status</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshLocBtn}
              onPress={refreshLocation}
              disabled={locating}
              accessibilityLabel="Refresh location"
            >
              {locating ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <View style={styles.refreshRow}>
                  <Feather name="refresh-cw" size={12} color={COLORS.primary} />
                  <Text style={styles.refreshLocText}> Refresh</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Location Info */}
          <View style={styles.metricsContainer}>
            {currentDistance != null && (
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Distance from office</Text>
                <Text
                  style={[
                    styles.metricValue,
                    {
                      color: isWithinRadius ? COLORS.accent : COLORS.danger,
                      fontWeight: '700'
                    }
                  ]}
                >
                  {currentDistance} m
                </Text>
              </View>
            )}

            {activeAccuracy != null && (
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>GPS accuracy</Text>
                <Text style={styles.metricValue}>± {Math.round(activeAccuracy)} m</Text>
              </View>
            )}
          </View>

          {/* Location Status Banner */}
          <View
            style={[
              styles.locationBanner,
              {
                backgroundColor: locationError
                  ? COLORS.badgeError
                  : isWithinRadius
                  ? COLORS.badgeSuccess
                  : activeLatitude != null
                  ? '#FEF3C7'
                  : COLORS.primaryLight
              }
            ]}
          >
            <Feather
              name={
                locationError
                  ? 'alert-triangle'
                  : isWithinRadius
                  ? 'check-circle'
                  : activeLatitude != null
                  ? 'alert-circle'
                  : 'loader'
              }
              size={16}
              color={
                locationError
                  ? COLORS.badgeErrorText
                  : isWithinRadius
                  ? COLORS.badgeSuccessText
                  : activeLatitude != null
                  ? '#92400E'
                  : COLORS.primary
              }
            />
            <Text
              style={[
                styles.locationBannerText,
                {
                  color: locationError
                    ? COLORS.badgeErrorText
                    : isWithinRadius
                    ? COLORS.badgeSuccessText
                    : activeLatitude != null
                    ? '#92400E'
                    : COLORS.primary
                }
              ]}
            >
              {getLocationMessage()}
            </Text>
          </View>
        </View>

        {/* Primary Action Button */}
        <View style={styles.actionCard}>
          {!isCheckedIn ? (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.checkInBtn,
                actionLoading && styles.btnDisabled
              ]}
              onPress={handleCheckIn}
              disabled={actionLoading}
              accessibilityLabel="Mark attendance"
              accessibilityRole="button"
            >
              {actionLoading ? (
                <View style={styles.actionBtnRow}>
                  <ActivityIndicator color={COLORS.white} size="small" />
                  <Text style={styles.actionBtnText}>  Marking Attendance...</Text>
                </View>
              ) : (
                <View style={styles.actionBtnRow}>
                  <Feather name="check-circle" size={24} color={COLORS.white} />
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionBtnText}>Mark Attendance</Text>
                    <Text style={styles.actionBtnSub}>Tap to mark your arrival (IN)</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ) : !isCheckedOut ? (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.checkOutBtn,
                actionLoading && styles.btnDisabled
              ]}
              onPress={handleCheckOut}
              disabled={actionLoading}
              accessibilityLabel="Out"
              accessibilityRole="button"
            >
              {actionLoading ? (
                <View style={styles.actionBtnRow}>
                  <ActivityIndicator color={COLORS.white} size="small" />
                  <Text style={styles.actionBtnText}>  Marking Out...</Text>
                </View>
              ) : (
                <View style={styles.actionBtnRow}>
                  <Feather name="log-out" size={24} color={COLORS.white} />
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionBtnText}>Out</Text>
                    <Text style={styles.actionBtnSub}>Tap to mark your departure (OUT)</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.completedNotice}>
              <View style={styles.completedIconWrap}>
                <Feather name="check-circle" size={36} color={COLORS.accent} />
              </View>
              <Text style={styles.completedText}>
                Attendance Completed
              </Text>
              <Text style={styles.completedSubtext}>
                You have marked OUT for today • Total: {workingDisplay}
              </Text>
            </View>
          )}
        </View>

        {/* Attendance Guidelines */}
        <View style={styles.ruleCard}>
          <View style={styles.cardTitleRow}>
            <Feather name="info" size={14} color={COLORS.textSecondary} />
            <Text style={styles.ruleTitle}>Attendance Guidelines</Text>
          </View>
          <Text style={styles.ruleItem}>
            • Tap "Mark Attendance" when you arrive to record your IN time.
          </Text>
          <Text style={styles.ruleItem}>
            • Tap "Out" when leaving the office to record your OUT time.
          </Text>
          <Text style={styles.ruleItem}>
            • If OUT was not marked on a previous day, a fresh "Mark Attendance" button is automatically ready the next day.
          </Text>
          <Text style={styles.ruleItem}>
            • One IN and OUT attendance cycle is recorded per working day.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  container: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl
  },
  header: {
    marginBottom: SPACING.md
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.secondary,
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2
  },
  messageBanner: {
    padding: SPACING.sm + 4,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondary
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700'
  },
  timeGrid: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm + 2,
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  timeBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 4
  },
  timeBlockDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4
  },
  timeBlockLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600'
  },
  timeBlockVal: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary
  },
  refreshLocBtn: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  refreshLocText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary
  },
  metricsContainer: {
    gap: 8,
    marginVertical: SPACING.xs
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  metricLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500'
  },
  metricValue: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: '600'
  },
  locationBanner: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  locationBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1
  },
  actionCard: {
    marginBottom: SPACING.md
  },
  actionBtn: {
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  actionTextCol: {
    alignItems: 'flex-start'
  },
  checkInBtn: {
    backgroundColor: COLORS.accent
  },
  checkOutBtn: {
    backgroundColor: COLORS.danger
  },
  actionBtnText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  actionBtnSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2
  },
  btnDisabled: {
    opacity: 0.6
  },
  completedNotice: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  completedIconWrap: {
    marginBottom: SPACING.sm
  },
  completedText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.secondary
  },
  completedSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4
  },
  ruleCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary
  },
  ruleItem: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginVertical: 2,
    paddingLeft: 4
  }
});
