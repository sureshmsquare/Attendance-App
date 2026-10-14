import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { AttendanceScreen } from '../screens/AttendanceScreen';
import { AttendanceHistoryScreen } from '../screens/AttendanceHistoryScreen';
import { LeaveScreen } from '../screens/LeaveScreen';
import { HalfDayScreen } from '../screens/HalfDayScreen';
import { PermissionScreen } from '../screens/PermissionScreen';
import { NotificationScreen } from '../screens/NotificationScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { notificationService } from '../services/notificationService';
import { COLORS, SPACING } from '../constants/theme';

const NAV_ITEMS = [
  { key: 'attendance', label: 'Today', icon: 'check-square' },
  { key: 'history', label: 'History', icon: 'calendar' },
  { key: 'leave', label: 'Leave', icon: 'briefcase' },
  { key: 'halfDay', label: 'Half-Day', icon: 'clock' },
  { key: 'permission', label: 'Permission', icon: 'file-text' },
  { key: 'notifications', label: 'Alerts', icon: 'bell', hasBadge: true },
  { key: 'profile', label: 'Profile', icon: 'user' },
];

/**
 * AppNavigator manages top-level authentication state navigation.
 * Unauthenticated -> LoginScreen
 * Authenticated   -> Tab navigation for all employee screens
 */
export const AppNavigator = () => {
  const { isAuthenticated, isLoading, token, apiUrl } = useAuth();
  const [activeTab, setActiveTab] = useState('attendance'); 
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await notificationService.getUnreadCount(token, apiUrl);
      if (res.ok && res.data?.data) {
        setUnreadCount(res.data.data.unreadCount || 0);
      }
    } catch {
      // Quiet fail in background
    }
  }, [token, apiUrl]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchUnreadCount, activeTab]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <View style={styles.container}>
      {/* Active Tab Screen */}
      <View style={styles.screenContainer}>
        {activeTab === 'attendance' && <AttendanceScreen />}
        {activeTab === 'history' && <AttendanceHistoryScreen />}
        {activeTab === 'leave' && <LeaveScreen />}
        {activeTab === 'halfDay' && <HalfDayScreen />}
        {activeTab === 'permission' && <PermissionScreen />}
        {activeTab === 'notifications' && <NotificationScreen />}
        {activeTab === 'profile' && <ProfileScreen />}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNavWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bottomNavScroll}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => setActiveTab(item.key)}
                accessibilityLabel={item.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <View style={styles.navIconWrapper}>
                  <Feather
                    name={item.icon}
                    size={18}
                    color={isActive ? COLORS.primary : COLORS.textSecondary}
                  />
                  {item.hasBadge && unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.navText, isActive && styles.navTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  screenContainer: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600'
  },
  bottomNavWrapper: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: SPACING.xs + 2,
    paddingBottom: SPACING.sm
  },
  bottomNavScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm + 4,
    borderRadius: 8,
    marginHorizontal: 2
  },
  navItemActive: {
    backgroundColor: COLORS.primaryLight
  },
  navIconWrapper: {
    position: 'relative',
    marginBottom: 2
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800'
  },
  navText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary
  },
  navTextActive: {
    color: COLORS.primary,
    fontWeight: '700'
  }
});

export default AppNavigator;
