import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  StatusBar,
  RefreshControl,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { permissionService } from '../services/permissionService';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { formatDateReadable, formatTime12h } from '../utils/formatters';

export const PermissionScreen = () => {
  const { token, apiUrl } = useAuth();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  // Form State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [permissionDate, setPermissionDate] = useState('');
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setFormError(null);
      const res = await permissionService.getPermissionHistory(token, { limit: 50 }, apiUrl);
      if (res.ok && res.data?.data) {
        setHistory(res.data.data.records || []);
      }
    } catch (err) {
      console.error('Failed to load permission history:', err);
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

  const setQuickToday = () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    setPermissionDate(today);
  };

  // Live minutes preview
  const getMinutesPreview = () => {
    if (!fromTime || !toTime) return null;
    const partsIn = fromTime.split(':').map(Number);
    const partsOut = toTime.split(':').map(Number);
    if (partsIn.length < 2 || partsOut.length < 2) return null;
    if (isNaN(partsIn[0]) || isNaN(partsIn[1]) || isNaN(partsOut[0]) || isNaN(partsOut[1])) return null;

    const startMins = partsIn[0] * 60 + partsIn[1];
    const endMins = partsOut[0] * 60 + partsOut[1];
    const diff = endMins - startMins;

    if (diff <= 0) return 'Invalid: End time must be after Start time';
    const hours = Math.floor(diff / 60);
    const remMins = diff % 60;
    if (hours > 0) {
      return `${diff} mins (${hours}h ${remMins}m)`;
    }
    return `${diff} mins`;
  };

  const handleApply = async () => {
    setFormError(null);

    if (!permissionDate.trim()) {
      setFormError('Permission date is required (YYYY-MM-DD)');
      return;
    }
    if (!fromTime.trim() || !toTime.trim()) {
      setFormError('Both from_time and to_time are required (HH:mm)');
      return;
    }
    if (!reason.trim()) {
      setFormError('Reason for permission is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await permissionService.applyPermission(
        {
          permissionDate: permissionDate.trim(),
          fromTime: fromTime.trim(),
          toTime: toTime.trim(),
          reason: reason.trim()
        },
        token,
        apiUrl
      );

      if (res.ok) {
        setShowApplyModal(false);
        setPermissionDate('');
        setFromTime('');
        setToTime('');
        setReason('');
        Alert.alert('Success', 'Permission request submitted successfully!');
        loadData();
      }
    } catch (err) {
      setFormError(err.message || 'Failed to submit permission request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = (id) => {
    Alert.alert(
      'Cancel Permission',
      'Are you sure you want to cancel this pending permission request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(id);
            try {
              const res = await permissionService.cancelPermission(id, token, apiUrl);
              if (res.ok) {
                Alert.alert('Cancelled', 'Permission request cancelled successfully.');
                loadData();
              }
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to cancel permission request');
            } finally {
              setCancellingId(null);
            }
          }
        }
      ]
    );
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'approved':
        return { bg: '#DCFCE7', text: '#15803D', label: 'Approved' };
      case 'rejected':
        return { bg: '#FEE2E2', text: '#B91C1C', label: 'Rejected' };
      case 'cancelled':
        return { bg: '#F1F5F9', text: '#64748B', label: 'Cancelled' };
      case 'pending':
      default:
        return { bg: '#FEF3C7', text: '#B45309', label: 'Pending' };
    }
  };

  const filteredHistory = history.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.status === activeFilter;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading permission requests...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Permissions</Text>
            <Text style={styles.headerSubtitle}>Short Working-Hours Leave Permission</Text>
          </View>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => {
              setFormError(null);
              setShowApplyModal(true);
            }}
          >
            <Text style={styles.applyBtnText}>+ Request Permission</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Pills */}
        <View style={styles.filtersRow}>
          {['all', 'pending', 'approved', 'cancelled'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.filterPill, activeFilter === tab && styles.filterPillActive]}
              onPress={() => setActiveFilter(tab)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === tab && styles.filterPillTextActive
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Permission List */}
        {filteredHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="file-text" size={36} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No permission requests yet</Text>
            <Text style={styles.emptySubtext}>
              {activeFilter !== 'all'
                ? `No ${activeFilter} permission requests found.`
                : 'Need to step out for short personal work? Tap "+ Request Permission".'}
            </Text>
          </View>
        ) : (
          filteredHistory.map((item) => {
            const badge = getStatusStyle(item.status);
            const isPending = item.status === 'pending';
            const isCancelling = cancellingId === item.id;

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationBadgeText}>
                      {item.total_minutes} mins
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.timeRow}>
                  <Text style={styles.timeLabel}>{formatDateReadable(item.permission_date)}</Text>
                  <Text style={styles.timeWindow}>
                    {formatTime12h(item.from_time)} – {formatTime12h(item.to_time)}
                  </Text>
                </View>

                <Text style={styles.reasonText}>{item.reason}</Text>

                <View style={styles.cardFooter}>
                  <Text style={styles.appliedText}>
                    Applied: {formatDateReadable(item.applied_at)}
                  </Text>

                  {isPending && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      disabled={isCancelling}
                      onPress={() => handleCancel(item.id)}
                    >
                      {isCancelling ? (
                        <ActivityIndicator size="small" color="#E11D48" />
                      ) : (
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Apply Permission Modal */}
      <Modal visible={showApplyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Short Permission</Text>
              <TouchableOpacity onPress={() => setShowApplyModal(false)}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {formError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              )}

              {/* Date Input */}
              <Text style={styles.fieldLabel}>Permission Date *</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textSecondary}
                value={permissionDate}
                onChangeText={setPermissionDate}
              />

              <TouchableOpacity style={styles.quickTodayBtn} onPress={setQuickToday}>
                <Text style={styles.quickTodayText}>Set Today's Date</Text>
              </TouchableOpacity>

              {/* Time Inputs */}
              <View style={styles.timeInputRow}>
                <View style={{ flex: 1, marginRight: SPACING.sm }}>
                  <Text style={styles.fieldLabel}>From Time *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="HH:mm (e.g. 10:00)"
                    placeholderTextColor={COLORS.textSecondary}
                    value={fromTime}
                    onChangeText={setFromTime}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>To Time *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="HH:mm (e.g. 11:30)"
                    placeholderTextColor={COLORS.textSecondary}
                    value={toTime}
                    onChangeText={setToTime}
                  />
                </View>
              </View>

              {/* Live Preview */}
              {getMinutesPreview() && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>Estimated Duration:</Text>
                  <Text style={styles.previewValue}>{getMinutesPreview()}</Text>
                </View>
              )}

              {/* Reason Input */}
              <Text style={styles.fieldLabel}>Reason *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Brief reason for leaving office premises..."
                placeholderTextColor={COLORS.textSecondary}
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                disabled={submitting}
                onPress={handleApply}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Permission Request</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2
  },
  applyBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md
  },
  applyBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14
  },
  filtersRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md
  },
  filterPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.xs
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary
  },
  filterPillTextActive: {
    color: COLORS.white
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs
  },
  durationBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm
  },
  durationBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4
  },
  timeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  timeWindow: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary
  },
  reasonText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 4
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  appliedText: {
    fontSize: 11,
    color: COLORS.textSecondary
  },
  cancelBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm
  },
  cancelBtnText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700'
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary
  },
  modalCloseIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textSecondary,
    padding: 4
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600'
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 2,
    fontSize: 14,
    color: COLORS.textPrimary
  },
  quickTodayBtn: {
    alignSelf: 'flex-start',
    marginVertical: SPACING.xs,
    paddingVertical: 4,
    marginBottom: SPACING.md
  },
  quickTodayText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary
  },
  timeInputRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md
  },
  previewBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
    marginBottom: SPACING.lg
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center'
  },
  submitBtnDisabled: {
    opacity: 0.6
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700'
  }
});

export default PermissionScreen;
