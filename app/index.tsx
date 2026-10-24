// app/index.tsx
// Demo role picker. No login: the spec uses two hard-coded demo roles.
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, TOUCH_TARGET } from '@/lib/theme';

export default function RolePickerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Choose a demo role</Text>
      <Link href="/rentals" style={styles.button}>
        Counter staff
      </Link>
      <Link href="/orders" style={styles.button}>
        Parts inspector
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heading: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '600',
  },
  button: {
    minHeight: TOUCH_TARGET,
    lineHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 18,
  },
});
