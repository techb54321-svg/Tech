import { Stack } from 'expo-router';

import { useColors } from '@/theme';

export default function OnboardingLayout() {
  const c = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: '',
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.primary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.background },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
