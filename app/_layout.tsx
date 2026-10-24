// app/_layout.tsx
// Root navigator with the dark theme applied to every screen header.
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/lib/theme';

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.background },
};

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={{ title: 'I Inspect' }} />
      </Stack>
    </>
  );
}
