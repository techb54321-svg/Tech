import { router } from 'expo-router';
import { View } from 'react-native';

import { StatePicker, ZonePicker } from '@/components/location-pickers';
import { AppText, Button, Screen } from '@/components/ui';
import { useAppState, useProfile } from '@/state/app-state';
import { space } from '@/theme';

export default function ChangeLocation() {
  const profile = useProfile();
  const { setProfile } = useAppState();
  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: space.md }}>
        <AppText variant="heading">State or territory</AppText>
        <StatePicker value={profile.state} onChange={(state) => setProfile({ ...profile, state })} />
      </View>
      <View style={{ gap: space.md }}>
        <AppText variant="heading">Climate zone</AppText>
        <ZonePicker
          value={profile.climate_zone}
          state={profile.state}
          onChange={(climate_zone) => setProfile({ ...profile, climate_zone })}
        />
      </View>
      <Button label="Done" onPress={() => router.back()} />
    </Screen>
  );
}
