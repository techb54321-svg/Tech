import { router } from 'expo-router';
import { View } from 'react-native';

import { ZonePicker } from '@/components/location-pickers';
import { AppText, Button, Screen } from '@/components/ui';
import { useAppState } from '@/state/app-state';
import { space } from '@/theme';

export default function ChooseZone() {
  const { profile, setProfile } = useAppState();
  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: space.sm }}>
        <AppText variant="title">What's your climate like?</AppText>
        <AppText tone="muted">
          Pick the one closest to where you live. If you're unsure, choose the place that sounds most
          like your weather. You can change this later in Settings.
        </AppText>
      </View>
      <ZonePicker
        value={profile?.climate_zone ?? null}
        state={profile?.state ?? null}
        onChange={(climate_zone) => profile && setProfile({ ...profile, climate_zone })}
      />
      <Button label="Continue" disabled={!profile} onPress={() => router.push('/onboarding/sign-in')} />
    </Screen>
  );
}
