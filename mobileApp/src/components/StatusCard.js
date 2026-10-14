import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const StatusCard = ({ title, status, isSuccess, details }) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: isSuccess ? COLORS.badgeSuccess : COLORS.badgeError }
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: isSuccess ? COLORS.badgeSuccessText : COLORS.badgeErrorText }
            ]}
          >
            {status}
          </Text>
        </View>
      </View>

      {details && (
        <View style={styles.detailsContainer}>
          {Object.entries(details).map(([key, val]) => (
            <View key={key} style={styles.detailRow}>
              <Text style={styles.detailKey}>{key}:</Text>
              <Text style={styles.detailVal}>{String(val)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  badge: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailsContainer: {
    marginTop: SPACING.sm + 4,
    paddingTop: SPACING.sm + 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
});
