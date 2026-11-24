import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppStateProvider, useAppState } from '@/state/app-state';
import { palette } from '@/theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { hydrated, onboarded } = useAppState();
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? palette.dark : palette.light;
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);

  if (!hydrated) return null;

  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.background,
      card: c.surface,
      text: c.text,
      border: c.border,
    },
  };

  const modalHeader = {
    headerShown: true,
    headerStyle: { backgroundColor: c.background },
    headerTintColor: c.primary,
    headerTitleStyle: { color: c.text },
    headerShadowVisible: false,
  } as const;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
        {/* First launch only */}
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        {/* The main app, once set up */}
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="crop/[id]" options={{ ...modalHeader, presentation: 'modal', title: 'Plant now' }} />
          <Stack.Screen name="plant/[id]" options={{ ...modalHeader, title: '' }} />
          <Stack.Screen name="change-location" options={{ ...modalHeader, title: 'Your garden location' }} />
          <Stack.Screen name="paywall" options={{ ...modalHeader, presentation: 'modal', title: '' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <RootNavigator />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
