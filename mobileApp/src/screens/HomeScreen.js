import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { StatusCard } from '../components/StatusCard';
import { checkBackendHealth } from '../services/healthService';
import { API_BASE_URL, DEV_LAN_IP, API_PORT } from '../constants/config';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { formatDateTime } from '../utils/helpers';

export default function HomeScreen() {
  const [apiUrl, setApiUrl] = useState(API_BASE_URL);
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchHealth = async (overrideUrl) => {
    const urlToUse = overrideUrl || apiUrl;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await checkBackendHealth(urlToUse);
      if (res.success) {
        setHealthData(res.data);
        setErrorMsg(null);
      } else {
        setHealthData(null);
        setErrorMsg(res.error);
      }
      setLastChecked(new Date().toISOString());
    } catch (err) {
      setHealthData(null);
      setErrorMsg(err.message || 'Connection failed');
      setLastChecked(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView contentContainerStyle={styles.container}>
        <Header
          title="Attendance App"
          subtitle="Phase 1: Architecture & Foundation"
        />

        {/* Mobile App Status */}
        <StatusCard
          title="Mobile Client"
          status="ONLINE"
          isSuccess={true}
          details={{
            'Framework': 'React Native (Expo)',
            'Architecture': 'Scalable Modular Structure',
            'Current Phase': 'Phase 1 of 6',
          }}
        />

        {/* Backend Health Check Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Backend Health Status</Text>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: healthData
                      ? COLORS.badgeSuccess
                      : COLORS.badgeError,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    {
                      color: healthData
                        ? COLORS.badgeSuccessText
                        : COLORS.badgeErrorText,
                    },
                  ]}
                >
                  {healthData ? 'CONNECTED' : 'DISCONNECTED'}
                </Text>
              </View>
            )}
          </View>

          {/* Health Details */}
          {healthData && (
            <View style={styles.healthDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Message:</Text>
                <Text style={[styles.detailVal, { color: COLORS.accent, fontWeight: '700' }]}>
                  {healthData.message}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Database:</Text>
                <Text style={[styles.detailVal, { fontWeight: '700' }]}>
                  {healthData.data?.database || 'N/A'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>API Version:</Text>
                <Text style={styles.detailVal}>
                  {healthData.data?.version || 'v1'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Server Status:</Text>
                <Text style={styles.detailVal}>
                  {healthData.data?.status || 'UP'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Server Time:</Text>
                <Text style={styles.detailVal}>
                  {formatDateTime(healthData.data?.timestamp)}
                </Text>
              </View>
            </View>
          )}

          {errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Connection Error:</Text>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {lastChecked && (
            <Text style={styles.lastCheckedText}>
              Last checked: {formatDateTime(lastChecked)}
            </Text>
          )}

          {/* API URL Config and Selector */}
          <View style={styles.urlSection}>
            <Text style={styles.urlLabel}>Backend API Base URL:</Text>
            <TextInput
              style={styles.urlInput}
              value={apiUrl}
              onChangeText={setApiUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://localhost:5000/api/v1"
            />

            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => {
                  const url = `http://localhost:${API_PORT}/api/v1`;
                  setApiUrl(url);
                  fetchHealth(url);
                }}
              >
                <Text style={styles.presetText}>localhost</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => {
                  const url = `http://10.0.2.2:${API_PORT}/api/v1`;
                  setApiUrl(url);
                  fetchHealth(url);
                }}
              >
                <Text style={styles.presetText}>10.0.2.2 (Android)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => {
                  const url = `http://${DEV_LAN_IP}:${API_PORT}/api/v1`;
                  setApiUrl(url);
                  fetchHealth(url);
                }}
              >
                <Text style={styles.presetText}>LAN IP</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Test / Retry Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => fetchHealth()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.actionButtonText}>Check Backend Health</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Phase 1 Verification Checklist */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Phase 1 Deliverables</Text>
          <View style={styles.checklist}>
            <Text style={styles.checkItem}>✓ Common Node/Express REST Backend</Text>
            <Text style={styles.checkItem}>✓ MySQL Database (attendanceApp) Connected</Text>
            <Text style={styles.checkItem}>✓ GET /api/v1/health Endpoint Functional</Text>
            <Text style={styles.checkItem}>✓ Clean REST Architecture & Error Handling</Text>
            <Text style={styles.checkItem}>✓ Scalable React Native App Structure</Text>
            <Text style={styles.checkItem}>✓ Ready for Phase 2 Implementation</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
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
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  healthDetails: {
    marginVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    padding: SPACING.sm + 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  detailKey: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  detailVal: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: COLORS.badgeError,
    padding: SPACING.sm + 4,
    borderRadius: RADIUS.sm,
    marginVertical: SPACING.sm,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.badgeErrorText,
    marginBottom: 2,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.badgeErrorText,
  },
  lastCheckedText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginVertical: SPACING.xs,
  },
  urlSection: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  urlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  urlInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs + 4,
    fontSize: 13,
    color: COLORS.secondary,
  },
  presetsRow: {
    flexDirection: 'row',
    marginTop: SPACING.xs + 2,
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  presetButton: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  presetText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  actionButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  checklist: {
    marginTop: SPACING.sm,
    gap: SPACING.xs + 2,
  },
  checkItem: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: '500',
  },
});
