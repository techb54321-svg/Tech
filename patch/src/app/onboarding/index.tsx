import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText, Button, Screen } from '@/components/ui';
import { space, useColors } from '@/theme';

export default function Welcome() {
  const c = useColors();
  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', gap: space.lg }}>
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: c.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Ionicons name="leaf" size={64} color={c.primary} />
        </View>
        <AppText variant="display">Patch</AppText>
        <AppText variant="heading" style={{ textAlign: 'center', fontWeight: '500' }}>
          Snap a plant. Know what it is, what's wrong, and what to do this month where you live.
        </AppText>
      </View>
      <View style={{ gap: space.md, marginTop: space.xxl }}>
        <Button label="Get started" onPress={() => router.push('/onboarding/state')} />
        <AppText variant="small" tone="muted" style={{ textAlign: 'center' }}>
          Made for Australian gardens.
        </AppText>
      </View>
    </Screen>
  );
}
