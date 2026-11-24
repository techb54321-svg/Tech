import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';

import { AppText, Notice, Screen } from '@/components/ui';
import { radius, space, useColors } from '@/theme';

/**
 * PHASE 1: the sign-in buttons just move on. Phase 2 connects real
 * Sign in with Apple (iPhone) and Sign in with Google (Android).
 */
export default function SignIn() {
  const c = useColors();
  const isIOS = Platform.OS === 'ios';
  const next = () => router.push('/onboarding/paywall');

  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: space.sm }}>
        <AppText variant="title">Save your garden</AppText>
        <AppText tone="muted">
          Sign in so your plants and photos are kept safe, even if you change phones. We only use your
          sign-in to keep your garden private to you.
        </AppText>
      </View>

      {isIOS ? (
        <Pressable
          onPress={next}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Apple"
          style={({ pressed }) => ({
            backgroundColor: c.text,
            borderRadius: radius.md,
            minHeight: 56,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.sm,
            opacity: pressed ? 0.8 : 1,
          })}>
          <Ionicons name="logo-apple" size={24} color={c.background} />
          <Text style={{ color: c.background, fontSize: 18, fontWeight: '600' }}>Sign in with Apple</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={next}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Google"
          style={({ pressed }) => ({
            backgroundColor: '#FFFFFF',
            borderColor: '#747775',
            borderWidth: 1,
            borderRadius: radius.md,
            minHeight: 56,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.sm,
            opacity: pressed ? 0.8 : 1,
          })}>
          <Ionicons name="logo-google" size={22} color="#1F1F1F" />
          <Text style={{ color: '#1F1F1F', fontSize: 18, fontWeight: '600' }}>Sign in with Google</Text>
        </Pressable>
      )}

      <Notice tone="info" icon="construct-outline">
        Test version: sign-in isn't connected yet, so this button just moves on.
      </Notice>
    </Screen>
  );
}
