// app/(inspector)/orders.tsx
// Parts inspector: diagnostic order queue. Built in Milestone 6.
import { Stack } from 'expo-router';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function OrdersScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Order queue' }} />
      <PlaceholderScreen title="Order queue" note="Inspector screens arrive in Milestone 6." />
    </>
  );
}
