import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { formatDateReadable } from '../utils/formatters';

export const ProfileScreen = () => {
  const { employee, logout, updateProfile, refreshProfile, apiUrl } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [phone, setPhone] = useState(employee?.phone || '');
  const [firstName, setFirstName] = useState(employee?.first_name || '');
  const [lastName, setLastName] = useState(employee?.last_name || '');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const initials = `${employee?.first_name?.[0] || 'E'}${employee?.last_name?.[0] || 'P'}`.toUpperCase();

  const handleRefresh = async () => {
    setRefreshing(true);
    setStatusMessage(null);
    try {
      await refreshProfile();
      setStatusMessage({ type: 'success', text: 'Profile refreshed from server.' });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to refresh profile.' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      await updateProfile({
        first_name: firstName,
        last_name: lastName,
        phone: phone.trim()
      });
      setIsEditing(false);
      setStatusMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    // Cross-platform confirm
    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm('Are you sure you want to log out?')) {
        logout();
      }
    } else {
      Alert.alert(
        'Confirm Logout',
        'Are you sure you want to log out from this device?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', style: 'destructive', onPress: () => logout() }
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top App Header */}
        <View style={styles.topBar}>
          <Text style={styles.screenTitle}>My Profile</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="refresh-cw" size={14} color={COLORS.primary} />
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Status Message Notification */}
        {statusMessage && (
          <View
            style={[
              styles.messageBanner,
              {
                backgroundColor:
                  statusMessage.type === 'success'
                    ? COLORS.badgeSuccess
                    : COLORS.badgeError,
              },
            ]}
          >
            <Text
              style={[
                styles.messageText,
                {
                  color:
                    statusMessage.type === 'success'
                      ? COLORS.badgeSuccessText
                      : COLORS.badgeErrorText,
                },
              ]}
            >
              {statusMessage.text}
            </Text>
          </View>
        )}

        {/* Profile Card Header */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={styles.employeeName}>
            {employee?.first_name} {employee?.last_name}
          </Text>

          <Text style={styles.designationText}>
            {employee?.designation || 'Staff Member'}
          </Text>

          <View style={styles.badgeRow}>
            <View style={styles.departmentBadge}>
              <Text style={styles.departmentBadgeText}>
                {employee?.department || 'General'}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    employee?.status === 'active'
                      ? COLORS.badgeSuccess
                      : COLORS.badgeError,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color:
                      employee?.status === 'active'
                        ? COLORS.badgeSuccessText
                        : COLORS.badgeErrorText,
                  },
                ]}
              >
                ● {employee?.status?.toUpperCase() || 'ACTIVE'}
              </Text>
            </View>
          </View>
        </View>

        {/* Employee Identity Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardSectionTitle}>Employee Information</Text>
            {!isEditing && (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => {
                  setFirstName(employee?.first_name || '');
                  setLastName(employee?.last_name || '');
                  setPhone(employee?.phone || '');
                  setIsEditing(true);
                  setStatusMessage(null);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Feather name="edit-2" size={12} color={COLORS.primary} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Details List */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Employee Code</Text>
            <Text style={[styles.infoValue, styles.boldValue]}>
              {employee?.employee_code}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Work Email</Text>
            <Text style={styles.infoValue}>{employee?.email}</Text>
          </View>

          {isEditing ? (
            <View style={styles.editForm}>
              <View style={styles.editInputGroup}>
                <Text style={styles.inputLabel}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
              <View style={styles.editInputGroup}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
              <View style={styles.editInputGroup}>
                <Text style={styles.inputLabel}>Contact Phone</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+1 555-0199"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.editActionsRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setIsEditing(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Contact Phone</Text>
                <Text style={styles.infoValue}>{employee?.phone || 'Not provided'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Department</Text>
                <Text style={styles.infoValue}>{employee?.department || 'N/A'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Designation</Text>
                <Text style={styles.infoValue}>{employee?.designation || 'N/A'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Member Since</Text>
                <Text style={styles.infoValue}>
                  {formatDateReadable(employee?.created_at)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Feather name="log-out" size={16} color={COLORS.white} />
            <Text style={styles.logoutButtonText}>Sign Out</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  badge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  refreshButton: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  refreshButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  messageBanner: {
    padding: SPACING.sm + 2,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  messageText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  profileHeaderCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  employeeName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.secondary,
    letterSpacing: -0.3,
  },
  designationText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  departmentBadge: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  departmentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  editBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  boldValue: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: COLORS.primary,
  },
  editForm: {
    marginTop: SPACING.sm,
  },
  editInputGroup: {
    marginBottom: SPACING.sm,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 4,
    fontSize: 13,
    color: COLORS.secondary,
  },
  editActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  cancelButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  logoutButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xs,
  },
  logoutButtonText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '700',
  },
});
