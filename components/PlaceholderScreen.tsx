// components/PlaceholderScreen.tsx
// Temporary screen body used until each milestone builds the real screen.
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/lib/theme';

type PlaceholderScreenProps = {
  title: string;
  note: string;
};

export function PlaceholderScreen({ title, note }: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '600',
  },
  note: {
    color: colors.textMuted,
    fontSize: 16,
  },
});
