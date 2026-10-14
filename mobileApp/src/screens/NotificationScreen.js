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
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../services/notificationService';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { formatRelativeTime, formatDateTimeReadable } from '../utils/formatters';

export const NotificationScreen = () => {
  const { token, apiUrl } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'attendance' | 'request'
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [listRes, countRes] = await Promise.all([
        notificationService.getNotifications(token, { limit: 50 }, apiUrl),
        notificationService.getUnreadCount(token, apiUrl)
      ]);

      if (listRes.ok && listRes.data?.data) {
        setNotifications(listRes.data.data.notifications || []);
      }
      if (countRes.ok && countRes.data?.data) {
        setUnreadCount(countRes.data.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiUrl]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleMarkAsRead = async (id) => {
    if (!token || actionLoadingId) return;
    setActionLoadingId(id);
    try {
      const res = await notificationService.markAsRead(id, token, apiUrl);
      if (res.ok) {
        setNotifications(prev =>
          prev.map(item => (item.id === id ? { ...item, is_read: 1 } : item))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        Alert.alert('Notice', res.data?.message || 'Could not update notification.');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to mark notification as read.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!token || markingAllRead || unreadCount === 0) return;
    setMarkingAllRead(true);
    try {
      const res = await notificationService.markAllAsRead(token, apiUrl);
      if (res.ok) {
        setNotifications(prev =>
          prev.map(item => ({ ...item, is_read: 1 }))
        );
        setUnreadCount(0);
      } else {
        Alert.alert('Notice', res.data?.message || 'Could not update notifications.');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to mark all as read.');
    } finally {
      setMarkingAllRead(false);
    }
  };

  // Filter items
  const filteredNotifications = notifications.filter(item => {
    if (activeFilter === 'unread') {
      return item.is_read === 0 || item.is_read === false;
    }
    if (activeFilter === 'attendance') {
      return item.type === 'attendance';
    }
    if (activeFilter === 'request') {
      return ['leave', 'half_day', 'permission'].includes(item.type);
    }
    return true;
  });

  const getTypeIcon = (type) => {
    switch (type) {
      case 'attendance':
        return 'check-square';
      case 'leave':
        return 'briefcase';
      case 'half_day':
        return 'clock';
      case 'permission':
        return 'file-text';
      default:
        return 'bell';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'attendance': return 'Attendance';
      case 'leave': return 'Leave';
      case 'half_day': return 'Half-Day';
      case 'permission': return 'Permission';
      default: return 'Notification';
    }
  };

  const getTypeBadgeStyle = (type) => {
    switch (type) {
      case 'attendance':
        return { backgroundColor: '#E0F2FE', color: '#0369A1' };
      case 'leave':
        return { backgroundColor: '#FEF3C7', color: '#B45309' };
      case 'half_day':
        return { backgroundColor: '#EDE9FE', color: '#6D28D9' };
      case 'permission':
        return { backgroundColor: '#FCE7F3', color: '#BE185D' };
      default:
        return { backgroundColor: '#F1F5F9', color: '#475569' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            {unreadCount > 0
              ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}`
              : 'All caught up'}
          </Text>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            style={[styles.markAllBtn, markingAllRead && styles.btnDisabled]}
            onPress={handleMarkAllAsRead}
            disabled={markingAllRead}
          >
            {markingAllRead ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.markAllBtnText}>Mark all read</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'all' && styles.filterChipTextActive
              ]}
            >
              All ({notifications.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'unread' && styles.filterChipActive]}
            onPress={() => setActiveFilter('unread')}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'unread' && styles.filterChipTextActive
              ]}
            >
              Unread ({unreadCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'attendance' && styles.filterChipActive]}
            onPress={() => setActiveFilter('attendance')}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'attendance' && styles.filterChipTextActive
              ]}
            >
              Attendance
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'request' && styles.filterChipActive]}
            onPress={() => setActiveFilter('request')}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'request' && styles.filterChipTextActive
              ]}
            >
              Requests
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
        >
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
            <Feather name="bell-off" size={40} color={COLORS.textSecondary} />
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter === 'unread'
                  ? 'You have read all your notifications!'
                  : 'New activities and updates will appear here.'}
              </Text>
            </View>
          ) : (
            filteredNotifications.map((item) => {
              const isUnread = item.is_read === 0 || item.is_read === false;
              const badgeStyle = getTypeBadgeStyle(item.type);
              const isActioning = actionLoadingId === item.id;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.card, isUnread && styles.cardUnread]}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (isUnread) handleMarkAsRead(item.id);
                  }}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.typeRow}>
                      <Feather name={getTypeIcon(item.type)} size={16} color={badgeStyle.color} />
                      <View
                        style={[
                          styles.typeBadge,
                          { backgroundColor: badgeStyle.backgroundColor }
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeBadgeText,
                            { color: badgeStyle.color }
                          ]}
                        >
                          {getTypeLabel(item.type)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.metaRow}>
                      {isUnread && <View style={styles.unreadDot} />}
                      <Text style={styles.timestamp}>
                        {formatRelativeTime(item.created_at)}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]}>
                    {item.title}
                  </Text>

                  <Text style={styles.cardMessage}>{item.message}</Text>

                  {isUnread && (
                    <View style={styles.cardFooter}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleMarkAsRead(item.id)}
                        disabled={isActioning}
                      >
                        {isActioning ? (
                          <ActivityIndicator size="small" color={COLORS.primary} />
                        ) : (
                          <Text style={styles.actionBtnText}>Mark as read</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  headerLeft: {
    flex: 1
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2
  },
  markAllBtn: {
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: '#C7D2FE'
  },
  markAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary
  },
  btnDisabled: {
    opacity: 0.6
  },
  filtersWrapper: {
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  filterScroll: {
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    gap: SPACING.xs + 2
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F1F5F9'
  },
  filterChipActive: {
    backgroundColor: COLORS.primary
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary
  },
  filterChipTextActive: {
    color: COLORS.white,
    fontWeight: '700'
  },
  content: {
    flex: 1
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl * 2
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 14,
    color: COLORS.textSecondary
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.sm
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm + 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  cardUnread: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs + 2
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  typeIcon: {
    fontSize: 16
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary
  },
  timestamp: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500'
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4
  },
  cardTitleUnread: {
    fontWeight: '700',
    color: '#1E1B4B'
  },
  cardMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.xs + 4,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#F3E8FF'
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary
  }
});

export default NotificationScreen;
