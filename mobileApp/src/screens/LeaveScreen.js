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
import { leaveService } from '../services/leaveService';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { formatDateReadable, formatDateTimeReadable } from '../utils/formatters';

export const LeaveScreen = () => {
  const { token, apiUrl } = useAuth();

  // State
  const [balances, setBalances] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'cancelled'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Modal & Form State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Detail Modal State
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  // Load Balances, Types, and History
  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setFormError(null);
      const [balRes, typesRes, histRes] = await Promise.all([
        leaveService.getLeaveBalances(token, selectedYear, apiUrl),
        leaveService.getLeaveTypes(token, apiUrl),
        leaveService.getLeaveHistory(token, { year: selectedYear, limit: 50 }, apiUrl)
      ]);

      if (balRes.ok && balRes.data?.data) {
        setBalances(balRes.data.data.balances || []);
      }
      if (typesRes.ok && typesRes.data?.data) {
        setLeaveTypes(typesRes.data.data || []);
        if (!selectedTypeId && typesRes.data.data.length > 0) {
          setSelectedTypeId(typesRes.data.data[0].id);
        }
      }
      if (histRes.ok && histRes.data?.data) {
        setHistory(histRes.data.data.records || []);
      }
    } catch (err) {
      console.error('Failed to load leave data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiUrl, selectedYear, selectedTypeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Quick Date Helpers (e.g. Set today)
  const setQuickToday = () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    setFromDate(today);
    setToDate(today);
  };

  // Submit Leave Application
  const handleApplyLeave = async () => {
    setFormError(null);

    if (!selectedTypeId) {
      setFormError('Please select a leave type');
      return;
    }
    if (!fromDate.trim() || !toDate.trim()) {
      setFormError('From date and To date are required (YYYY-MM-DD)');
      return;
    }
    if (fromDate > toDate) {
      setFormError('From date cannot be after To date');
      return;
    }
    if (!reason.trim()) {
      setFormError('Please state the reason for leave');
      return;
    }

    setSubmitting(true);
    try {
      const res = await leaveService.applyLeave(
        {
          leaveTypeId: selectedTypeId,
          fromDate: fromDate.trim(),
          toDate: toDate.trim(),
          reason: reason.trim()
        },
        token,
        apiUrl
      );

      if (res.ok) {
        setShowApplyModal(false);
        setReason('');
        setFromDate('');
        setToDate('');
        Alert.alert('Success', 'Leave application submitted successfully!');
        loadData();
      }
    } catch (err) {
      setFormError(err.message || 'Failed to submit leave application');
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel Leave Request
  const handleCancelLeave = (leaveId) => {
    Alert.alert(
      'Cancel Leave',
      'Are you sure you want to cancel this pending leave request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(leaveId);
            try {
              const res = await leaveService.cancelLeave(leaveId, token, apiUrl);
              if (res.ok) {
                Alert.alert('Cancelled', 'Leave request cancelled and balance restored.');
                if (selectedLeave && selectedLeave.id === leaveId) {
                  setSelectedLeave(null);
                }
                loadData();
              }
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to cancel leave request');
            } finally {
              setCancellingId(null);
            }
          }
        }
      ]
    );
  };

  // Filtered History
  const filteredHistory = history.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.status === activeFilter;
  });

  // Calculate day difference preview
  const getDurationPreview = () => {
    if (!fromDate || !toDate || fromDate.length < 10 || toDate.length < 10) return null;
    if (fromDate > toDate) return 'Invalid range';
    const d1 = new Date(`${fromDate}T00:00:00Z`);
    const d2 = new Date(`${toDate}T00:00:00Z`);
    const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} Day${diffDays > 1 ? 's' : ''}`;
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading leave balances & history...</Text>
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
            <Text style={styles.headerTitle}>Leave Management</Text>
            <Text style={styles.headerSubtitle}>Year {selectedYear} Balance & Requests</Text>
          </View>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => {
              setFormError(null);
              setShowApplyModal(true);
            }}
          >
            <Text style={styles.applyBtnText}>+ Apply Leave</Text>
          </TouchableOpacity>
        </View>

        {/* Leave Balances Grid */}
        <Text style={styles.sectionTitle}>Leave Balances</Text>
        <View style={styles.balancesContainer}>
          {balances.map((item) => (
            <View key={item.id} style={styles.balanceCard}>
              <View style={styles.balanceHeader}>
                <Text style={styles.balanceCodeBadge}>{item.leave_type_code}</Text>
                <Text style={styles.balanceTypeName}>{item.leave_type_name}</Text>
              </View>

              <View style={styles.balanceRemainingRow}>
                <Text style={styles.remainingDaysNum}>{parseFloat(item.remaining_days)}</Text>
                <Text style={styles.remainingDaysLabel}>Days Left</Text>
              </View>

              <View style={styles.balanceMetricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{parseFloat(item.total_days)}</Text>
                  <Text style={styles.metricLabel}>Total</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: '#E11D48' }]}>
                    {parseFloat(item.used_days)}
                  </Text>
                  <Text style={styles.metricLabel}>Used</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: COLORS.warning }]}>
                    {parseFloat(item.pending_days)}
                  </Text>
                  <Text style={styles.metricLabel}>Pending</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Leave History Section */}
        <View style={styles.historyHeaderRow}>
          <Text style={styles.sectionTitle}>Leave History</Text>
          <Text style={styles.recordCountText}>{filteredHistory.length} request(s)</Text>
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

        {/* History List */}
        {filteredHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="briefcase" size={36} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No leave requests found</Text>
            <Text style={styles.emptySubtext}>
              {activeFilter !== 'all'
                ? `No ${activeFilter} requests for ${selectedYear}`
                : 'No leave requests yet. Tap "+ Apply Leave" to request time off.'}
            </Text>
          </View>
        ) : (
          filteredHistory.map((item) => {
            const badge = getStatusStyle(item.status);
            const isPending = item.status === 'pending';
            const isCancelling = cancellingId === item.id;

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.historyCard}
                activeOpacity={0.8}
                onPress={() => setSelectedLeave(item)}
              >
                <View style={styles.historyCardHeader}>
                  <View style={styles.historyTypeRow}>
                    <Text style={styles.historyTypeCode}>{item.leave_type_code}</Text>
                    <Text style={styles.historyTypeName}>{item.leave_type_name}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.historyDatesRow}>
                  <Text style={styles.datesLabel}>Period:</Text>
                  <Text style={styles.datesValue}>
                    {formatDateReadable(item.from_date)} – {formatDateReadable(item.to_date)}
                  </Text>
                  <Text style={styles.totalDaysBadge}>{item.total_days} Day(s)</Text>
                </View>

                <Text style={styles.historyReason} numberOfLines={2}>
                  {item.reason}
                </Text>

                <View style={styles.historyCardFooter}>
                  <Text style={styles.appliedDateText}>
                    Applied: {formatDateReadable(item.applied_at)}
                  </Text>

                  {isPending && (
                    <TouchableOpacity
                      style={styles.cancelActionBtn}
                      disabled={isCancelling}
                      onPress={() => handleCancelLeave(item.id)}
                    >
                      {isCancelling ? (
                        <ActivityIndicator size="small" color="#E11D48" />
                      ) : (
                        <Text style={styles.cancelActionText}>Cancel Request</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Apply Leave Modal */}
      <Modal visible={showApplyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply For Leave</Text>
              <TouchableOpacity onPress={() => setShowApplyModal(false)}>
                <Feather name="x" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {formError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              )}

              {/* Leave Type Selector */}
              <Text style={styles.fieldLabel}>Leave Type *</Text>
              <View style={styles.typeSelectorRow}>
                {leaveTypes.map((type) => {
                  const isSelected = selectedTypeId === type.id;
                  const matchingBal = balances.find((b) => b.leave_type_id === type.id);
                  const remaining = matchingBal ? parseFloat(matchingBal.remaining_days) : 0;

                  return (
                    <TouchableOpacity
                      key={type.id}
                      style={[styles.typeOptionCard, isSelected && styles.typeOptionCardSelected]}
                      onPress={() => setSelectedTypeId(type.id)}
                    >
                      <Text
                        style={[
                          styles.typeOptionCode,
                          isSelected && styles.typeOptionCodeSelected
                        ]}
                      >
                        {type.code}
                      </Text>
                      <Text style={styles.typeOptionName}>{type.name}</Text>
                      <Text style={styles.typeOptionAvail}>{remaining} left</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Date Inputs */}
              <View style={styles.dateRow}>
                <View style={{ flex: 1, marginRight: SPACING.sm }}>
                  <Text style={styles.fieldLabel}>From Date *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={COLORS.textSecondary}
                    value={fromDate}
                    onChangeText={setFromDate}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>To Date *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={COLORS.textSecondary}
                    value={toDate}
                    onChangeText={setToDate}
                  />
                </View>
              </View>

              {/* Quick Helper Button */}
              <TouchableOpacity style={styles.quickTodayBtn} onPress={setQuickToday}>
                <Text style={styles.quickTodayText}>Set Today's Date</Text>
              </TouchableOpacity>

              {/* Duration Preview */}
              {getDurationPreview() && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>Calculated Duration:</Text>
                  <Text style={styles.previewValue}>{getDurationPreview()}</Text>
                </View>
              )}

              {/* Reason Input */}
              <Text style={styles.fieldLabel}>Reason for Leave *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Explain the reason for requesting leave..."
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
                onPress={handleApplyLeave}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Leave Application</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Leave Details Modal */}
      <Modal visible={Boolean(selectedLeave)} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedLeave && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Leave Details</Text>
                  <TouchableOpacity onPress={() => setSelectedLeave(null)}>
                    <Text style={styles.modalCloseIcon}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>
                    {selectedLeave.leave_type_name} ({selectedLeave.leave_type_code})
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Period:</Text>
                  <Text style={styles.detailValue}>
                    {formatDateReadable(selectedLeave.from_date)} – {formatDateReadable(selectedLeave.to_date)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total Days:</Text>
                  <Text style={styles.detailValue}>{selectedLeave.total_days} Day(s)</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusStyle(selectedLeave.status).bg }
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: getStatusStyle(selectedLeave.status).text }
                      ]}
                    >
                      {getStatusStyle(selectedLeave.status).label}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Reason:</Text>
                  <Text style={styles.detailValue}>{selectedLeave.reason}</Text>
                </View>

                {selectedLeave.remarks && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Remarks:</Text>
                    <Text style={styles.detailValue}>{selectedLeave.remarks}</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Applied On:</Text>
                  <Text style={styles.detailValue}>
                    {formatDateTimeReadable(selectedLeave.applied_at)}
                  </Text>
                </View>

                {selectedLeave.status === 'pending' && (
                  <TouchableOpacity
                    style={[styles.cancelActionBtn, { marginTop: SPACING.md }]}
                    onPress={() => handleCancelLeave(selectedLeave.id)}
                  >
                    <Text style={styles.cancelActionText}>Cancel this Leave Request</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
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
    borderRadius: RADIUS.md,
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4
  },
  applyBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm
  },
  balancesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg
  },
  balanceCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3
  },
  balanceHeader: {
    alignItems: 'center',
    marginBottom: SPACING.xs
  },
  balanceCodeBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm
  },
  balanceTypeName: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center'
  },
  balanceRemainingRow: {
    alignItems: 'center',
    marginVertical: SPACING.xs
  },
  remainingDaysNum: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.accent
  },
  remainingDaysLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary
  },
  balanceMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
    marginTop: 4
  },
  metricItem: {
    alignItems: 'center'
  },
  metricValue: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  metricLabel: {
    fontSize: 9,
    color: COLORS.textSecondary
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs
  },
  recordCountText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500'
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
  historyCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs
  },
  historyTypeRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  historyTypeCode: {
    fontWeight: '800',
    fontSize: 13,
    color: COLORS.primary,
    marginRight: 6
  },
  historyTypeName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary
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
  historyDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4
  },
  datesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginRight: 4
  },
  datesValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1
  },
  totalDaysBadge: {
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#F1F5F9',
    color: COLORS.textPrimary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm
  },
  historyReason: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 4
  },
  historyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  appliedDateText: {
    fontSize: 11,
    color: COLORS.textSecondary
  },
  cancelActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: '#FEE2E2',
    alignItems: 'center'
  },
  cancelActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C'
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
  typeSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md
  },
  typeOptionCard: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    marginHorizontal: 3
  },
  typeOptionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight
  },
  typeOptionCode: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary
  },
  typeOptionCodeSelected: {
    color: COLORS.primary
  },
  typeOptionName: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 2
  },
  typeOptionAvail: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.accent,
    marginTop: 4
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: SPACING.xs
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
    paddingVertical: 4
  },
  quickTodayText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary
  },
  previewBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginVertical: SPACING.sm
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary
  },
  previewValue: {
    fontSize: 14,
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
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  detailLabel: {
    width: 90,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary
  }
});

export default LeaveScreen;
