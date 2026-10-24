// app/(counter)/rentals.tsx
// Counter staff: rental list. Built in Milestone 3.
import { Stack } from 'expo-router';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function RentalsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Rentals' }} />
      <PlaceholderScreen title="Rental list" note="Counter screens arrive in Milestone 3." />
    </>
  );
}
