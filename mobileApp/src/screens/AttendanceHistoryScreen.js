import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  StatusBar,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { attendanceService } from '../services/attendanceService';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { formatTime12h, formatDateWithDay, formatDateReadable, formatDuration, friendlyErrorMessage } from '../utils/formatters';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const AttendanceHistoryScreen = () => {
  const { token, apiUrl } = useAuth();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const [statusFilter, setStatusFilter] = useState('all');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      if (showCustomRange && (customFromDate || customToDate)) {
        const res = await attendanceService.getAttendanceHistory(
          {
            fromDate: customFromDate || undefined,
            toDate: customToDate || undefined,
            status: statusFilter !== 'all' ? statusFilter : undefined,
            limit: 100
          },
          token,
          apiUrl
        );

        if (res.ok && res.data?.data) {
          setRecords(res.data.data.records || []);
          const sumRes = await attendanceService.getAttendanceSummary(
            {
              fromDate: customFromDate || undefined,
              toDate: customToDate || undefined
            },
            token,
            apiUrl
          );
          if (sumRes.ok && sumRes.data?.data?.summary) {
            setSummary(sumRes.data.data.summary);
          }
        }
      } else {
        const res = await attendanceService.getMonthlyAttendance(
          { year: selectedYear, month: selectedMonth },
          token,
          apiUrl
        );

        if (res.ok && res.data?.data) {
          let recs = res.data.data.records || [];
          if (statusFilter !== 'all') {
            recs = recs.filter((r) => r.status === statusFilter);
          }
          setRecords(recs);
          setSummary(res.data.data.summary || null);
        }
      }
    } catch (err) {
      setErrorMessage(friendlyErrorMessage(err));
      setRecords([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [token, apiUrl, selectedYear, selectedMonth, statusFilter, showCustomRange, customFromDate, customToDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePrevMonth = () => {
    setShowCustomRange(false);
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    setShowCustomRange(false);
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const handleCurrentMonth = () => {
    setShowCustomRange(false);
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth() + 1);
    setCustomFromDate('');
    setCustomToDate('');
  };

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'completed':
        return { label: 'Completed', bg: COLORS.badgeSuccess, color: COLORS.badgeSuccessText, icon: 'check-circle' };
      case 'present':
        return { label: 'In Progress', bg: COLORS.primaryLight, color: COLORS.primary, icon: 'clock' };
      default:
        return { label: status, bg: '#F1F5F9', color: '#64748B', icon: 'minus-circle' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Attendance History</Text>
          <Text style={styles.subtitle}>Review your past attendance records</Text>
        </View>

        {/* Month Selector */}
        <View style={styles.monthSelectorCard}>
          <View style={styles.monthNavRow}>
            <TouchableOpacity style={styles.monthArrowBtn} onPress={handlePrevMonth} accessibilityLabel="Previous month">
              <Feather name="chevron-left" size={18} color={COLORS.secondary} />
            </TouchableOpacity>

            <View style={styles.monthTitleContainer}>
              <Text style={styles.monthTitle}>
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </Text>
            </View>

            <TouchableOpacity style={styles.monthArrowBtn} onPress={handleNextMonth} accessibilityLabel="Next month">
              <Feather name="chevron-right" size={18} color={COLORS.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.rangeOptionsRow}>
            <TouchableOpacity
              style={[styles.smallOptionBtn, !showCustomRange && styles.smallOptionActive]}
              onPress={handleCurrentMonth}
            >
              <Text style={[styles.smallOptionText, !showCustomRange && styles.smallOptionTextActive]}>
                This Month
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallOptionBtn, showCustomRange && styles.smallOptionActive]}
              onPress={() => setShowCustomRange(!showCustomRange)}
            >
              <Text style={[styles.smallOptionText, showCustomRange && styles.smallOptionTextActive]}>
                {showCustomRange ? 'Hide Date Filter' : 'Custom Date Range'}
              </Text>
            </TouchableOpacity>
          </View>

          {showCustomRange && (
            <View style={styles.dateFilterContainer}>
              <View style={styles.dateInputRow}>
                <View style={styles.dateInputCol}>
                  <Text style={styles.inputLabel}>From Date</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    value={customFromDate}
                    onChangeText={setCustomFromDate}
                  />
                </View>
                <View style={styles.dateInputCol}>
                  <Text style={styles.inputLabel}>To Date</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    value={customToDate}
                    onChangeText={setCustomToDate}
                  />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Status Filter Tabs */}
        <View style={styles.statusFilterRow}>
          {[
            { key: 'all', label: 'All' },
            { key: 'completed', label: 'Completed' },
            { key: 'present', label: 'In Progress' }
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.statusFilterBtn,
                statusFilter === item.key && styles.statusFilterBtnActive
              ]}
              onPress={() => setStatusFilter(item.key)}
            >
              <Text
                style={[
                  styles.statusFilterText,
                  statusFilter === item.key && styles.statusFilterTextActive
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Monthly Summary */}
        {summary && (
          <View style={styles.summaryCard}>
            <View style={styles.cardTitleRow}>
              <Feather name="bar-chart-2" size={15} color={COLORS.secondary} />
              <Text style={styles.summaryTitle}>Monthly Summary</Text>
            </View>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryVal}>
                  {summary.presentDays != null ? summary.presentDays : summary.totalRecords || 0}
                </Text>
                <Text style={styles.summaryLabel}>Total Days</Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: COLORS.accent }]}>
                  {summary.completedDays != null ? summary.completedDays : summary.completedRecords || 0}
                </Text>
                <Text style={styles.summaryLabel}>Completed</Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: COLORS.warning }]}>
                  {summary.incompleteDays != null ? summary.incompleteDays : summary.incompleteRecords || 0}
                </Text>
                <Text style={styles.summaryLabel}>Incomplete</Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: COLORS.primary }]}>
                  {summary.totalWorkingHoursFormatted || '0h 00m'}
                </Text>
                <Text style={styles.summaryLabel}>Total Hours</Text>
              </View>
            </View>

            {summary.averageWorkingHoursFormatted && (
              <View style={styles.avgRow}>
                <Text style={styles.avgLabel}>Average Working Hours / Day</Text>
                <Text style={styles.avgVal}>{summary.averageWorkingHoursFormatted}</Text>
              </View>
            )}
          </View>
        )}

        {/* Error */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <View style={styles.errorContent}>
              <Feather name="alert-circle" size={16} color={COLORS.badgeErrorText} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Records Header */}
        <View style={styles.recordsHeaderRow}>
          <Text style={styles.recordsHeaderTitle}>
            Daily Records ({records.length})
          </Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchData} disabled={loading} accessibilityLabel="Refresh records">
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <View style={styles.refreshRow}>
                <Feather name="refresh-cw" size={12} color={COLORS.primary} />
                <Text style={styles.refreshText}> Refresh</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Records List */}
        {loading && records.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : records.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="clipboard" size={36} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No Attendance Records</Text>
            <Text style={styles.emptySubtitle}>
              No records found for the selected period.
            </Text>
          </View>
        ) : (
          records.map((item) => {
            const status = getStatusDisplay(item.status);
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.recordCard}
                onPress={() => setSelectedRecord(item)}
                activeOpacity={0.7}
                accessibilityLabel={`Attendance record for ${formatDateReadable(item.attendance_date)}`}
              >
                <View style={styles.recordHeader}>
                  <Text style={styles.recordDate}>
                    {formatDateWithDay(item.attendance_date)}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                    <Feather name={status.icon} size={10} color={status.color} />
                    <Text style={[styles.statusPillText, { color: status.color }]}>
                      {status.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.recordTimesRow}>
                  <View style={styles.recordTimeCol}>
                    <Text style={styles.timeLabel}>Check-In</Text>
                    <Text style={styles.timeVal}>
                      {item.check_in_time ? formatTime12h(item.check_in_time) : '--:--'}
                    </Text>
                  </View>

                  <View style={styles.recordTimeCol}>
                    <Text style={styles.timeLabel}>Check-Out</Text>
                    <Text style={styles.timeVal}>
                      {item.check_out_time ? formatTime12h(item.check_out_time) : '--:--'}
                    </Text>
                  </View>

                  <View style={styles.recordTimeCol}>
                    <Text style={styles.timeLabel}>Working</Text>
                    <Text style={[styles.timeVal, { color: COLORS.primary, fontWeight: '700' }]}>
                      {item.working_minutes != null ? formatDuration(item.working_minutes) : (item.workingHoursFormatted || '--')}
                    </Text>
                  </View>
                </View>

                {(item.isLate === true || item.isEarlyCheckout === true) && (
                  <View style={styles.tagsRow}>
                    {item.isLate === true && (
                      <View style={styles.lateTag}>
                        <Feather name="alert-circle" size={10} color={COLORS.badgeErrorText} />
                        <Text style={styles.lateTagText}> Late Check-In</Text>
                      </View>
                    )}
                    {item.isEarlyCheckout === true && (
                      <View style={styles.earlyTag}>
                        <Feather name="alert-triangle" size={10} color="#92400E" />
                        <Text style={styles.earlyTagText}> Early Check-Out</Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.tapRow}>
                  <Text style={styles.tapToViewText}>View details</Text>
                  <Feather name="chevron-right" size={14} color={COLORS.primary} />
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Record Detail Modal */}
        <Modal
          visible={Boolean(selectedRecord)}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedRecord(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Attendance Details</Text>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setSelectedRecord(null)}
                  accessibilityLabel="Close details"
                >
                  <Feather name="x" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {selectedRecord && (
                <View style={styles.modalBody}>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Date</Text>
                    <Text style={styles.modalVal}>
                      {formatDateWithDay(selectedRecord.attendance_date)}
                    </Text>
                  </View>

                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Status</Text>
                    <Text
                      style={[
                        styles.modalVal,
                        {
                          color:
                            selectedRecord.status === 'completed'
                              ? COLORS.accent
                              : COLORS.warning,
                          fontWeight: '700'
                        }
                      ]}
                    >
                      {selectedRecord.status === 'completed' ? 'Completed' : 'In Progress'}
                    </Text>
                  </View>

                  <View style={styles.modalDivider} />

                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Check-In</Text>
                    <Text style={styles.modalVal}>{formatTime12h(selectedRecord.check_in_time)}</Text>
                  </View>

                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Check-Out</Text>
                    <Text style={styles.modalVal}>
                      {selectedRecord.check_out_time ? formatTime12h(selectedRecord.check_out_time) : 'Not yet'}
                    </Text>
                  </View>

                  <View style={styles.modalDivider} />

                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Working Duration</Text>
                    <Text
                      style={[
                        styles.modalVal,
                        { color: COLORS.primary, fontWeight: '700' }
                      ]}
                    >
                      {selectedRecord.working_minutes != null
                        ? formatDuration(selectedRecord.working_minutes)
                        : (selectedRecord.workingHoursFormatted || '--')}
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={styles.modalDoneBtn}
                onPress={() => setSelectedRecord(null)}
              >
                <Text style={styles.modalDoneBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  header: { marginBottom: SPACING.md },
  screenTitle: { fontSize: 24, fontWeight: '800', color: COLORS.secondary, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  monthSelectorCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md, elevation: 2 },
  monthNavRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monthArrowBtn: { width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  monthTitleContainer: { alignItems: 'center' },
  monthTitle: { fontSize: 16, fontWeight: '800', color: COLORS.secondary },
  rangeOptionsRow: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm, marginTop: SPACING.sm, paddingTop: SPACING.xs, borderTopWidth: 1, borderTopColor: COLORS.border },
  smallOptionBtn: { paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.xs, borderRadius: RADIUS.sm, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  smallOptionActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  smallOptionText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  smallOptionTextActive: { color: COLORS.primary },
  dateFilterContainer: { marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  dateInputRow: { flexDirection: 'row', gap: SPACING.sm },
  dateInputCol: { flex: 1 },
  inputLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4, fontWeight: '600' },
  textInput: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs + 2, fontSize: 12, color: COLORS.secondary },
  statusFilterRow: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: RADIUS.sm, padding: 3, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  statusFilterBtn: { flex: 1, paddingVertical: SPACING.xs + 2, alignItems: 'center', borderRadius: RADIUS.sm - 2 },
  statusFilterBtnActive: { backgroundColor: COLORS.primary },
  statusFilterText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  statusFilterTextActive: { color: COLORS.white },
  summaryCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md, elevation: 2 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: COLORS.secondary },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.background, borderRadius: RADIUS.sm, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { fontSize: 15, fontWeight: '800', color: COLORS.secondary },
  summaryLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2, fontWeight: '600' },
  avgRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm, paddingTop: SPACING.xs + 2, borderTopWidth: 1, borderTopColor: COLORS.border },
  avgLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  avgVal: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  errorBox: { backgroundColor: COLORS.badgeError, padding: SPACING.sm, borderRadius: RADIUS.sm, marginBottom: SPACING.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorContent: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  errorText: { fontSize: 12, color: COLORS.badgeErrorText, fontWeight: '600', flex: 1 },
  retryBtn: { backgroundColor: COLORS.white, paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm },
  retryBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.danger },
  recordsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  recordsHeaderTitle: { fontSize: 14, fontWeight: '700', color: COLORS.secondary },
  refreshBtn: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, backgroundColor: COLORS.card, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border },
  refreshRow: { flexDirection: 'row', alignItems: 'center' },
  refreshText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  loadingContainer: { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.xl, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.secondary },
  emptySubtitle: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
  recordCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm, elevation: 1 },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm, paddingBottom: SPACING.xs, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  recordDate: { fontSize: 14, fontWeight: '700', color: COLORS.secondary },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  recordTimesRow: { flexDirection: 'row', justifyContent: 'space-between' },
  recordTimeCol: { flex: 1 },
  timeLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 },
  timeVal: { fontSize: 13, fontWeight: '600', color: COLORS.secondary },
  tagsRow: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.xs + 2 },
  lateTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.badgeError, paddingHorizontal: SPACING.xs + 2, paddingVertical: 2, borderRadius: RADIUS.sm },
  lateTagText: { fontSize: 10, fontWeight: '700', color: COLORS.badgeErrorText },
  earlyTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: SPACING.xs + 2, paddingVertical: 2, borderRadius: RADIUS.sm },
  earlyTagText: { fontSize: 10, fontWeight: '700', color: '#92400E' },
  tapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: SPACING.xs + 4, gap: 4 },
  tapToViewText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.md },
  modalCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.lg, width: '100%', maxWidth: 420, elevation: 6 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.secondary },
  closeBtn: { padding: SPACING.xs },
  modalBody: { marginBottom: SPACING.md },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  modalLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  modalVal: { fontSize: 13, color: COLORS.secondary, fontWeight: '600' },
  modalDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xs },
  modalDoneBtn: { backgroundColor: COLORS.primary, paddingVertical: SPACING.sm + 4, borderRadius: RADIUS.md, alignItems: 'center' },
  modalDoneBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 }
});
