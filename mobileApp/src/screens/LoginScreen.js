import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const LoginScreen = () => {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await login(email.trim(), password);
    } catch (error) {
      const msg = error.message || '';
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('Fetch request')) {
        setErrorMessage('Unable to connect to the server. Please check your internet connection.');
      } else if (msg.includes('401') || msg.includes('Invalid')) {
        setErrorMessage('Invalid email or password. Please try again.');
      } else {
        setErrorMessage(msg || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header & Logo */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Feather name="clock" size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.appTitle}>Attendance App</Text>
            <Text style={styles.subtitle}>Employee Self-Service Portal</Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Employee Login</Text>
            <Text style={styles.cardSubtitle}>Sign in with your work credentials</Text>

            {/* Error Banner */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color={COLORS.badgeErrorText} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Feather name="mail" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your work email"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Feather name="lock" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityLabel="Sign in"
              accessibilityRole="button"
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={COLORS.white} size="small" />
                  <Text style={styles.loginButtonText}>  Signing In...</Text>
                </View>
              ) : (
                <View style={styles.loadingRow}>
                  <Feather name="log-in" size={18} color={COLORS.white} />
                  <Text style={styles.loginButtonText}>  Sign In</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Quick Fill Demo Button */}
            <TouchableOpacity
              style={styles.demoFillBtn}
              onPress={() => {
                setEmail('employee@example.com');
                setPassword('password123');
              }}
              accessibilityLabel="Fill demo credentials"
            >
              <Feather name="zap" size={14} color={COLORS.primary} />
              <Text style={styles.demoFillText}>Quick Fill: employee@example.com</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Feather name="shield" size={14} color={COLORS.textSecondary} />
            <Text style={styles.footerText}>
              Accounts are managed by your administrator.{'\n'}Contact HR for login credentials.
            </Text>
          </View>

          <Text style={styles.versionText}>Version 1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    padding: SPACING.md,
    paddingTop: SPACING.xl + 16,
    paddingBottom: SPACING.xxl,
    justifyContent: 'center',
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.lg + 8,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.secondary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg + 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: SPACING.lg,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  errorBox: {
    backgroundColor: COLORS.badgeError,
    padding: SPACING.sm + 4,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: COLORS.badgeErrorText,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    marginBottom: SPACING.md + 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: SPACING.xs + 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    paddingVertical: SPACING.sm + 6,
    fontSize: 15,
    color: COLORS.secondary,
  },
  eyeButton: {
    padding: SPACING.xs,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  demoFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm + 2,
    marginTop: SPACING.md,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  demoFillText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  versionText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
