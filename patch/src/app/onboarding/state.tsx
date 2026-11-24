import { router } from 'expo-router';
import { View } from 'react-native';

import { StatePicker } from '@/components/location-pickers';
import { AppText, Button, Screen } from '@/components/ui';
import { DEFAULT_COUNTRY, SUGGESTED_ZONE } from '@/lib/location';
import { useAppState } from '@/state/app-state';
import { space } from '@/theme';

export default function ChooseState() {
  const { profile, setProfile } = useAppState();
  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: space.sm }}>
        <AppText variant="title">Where's your garden?</AppText>
        <AppText tone="muted">
          Choose your state or territory. We use this for local planting times and weed rules. We
          never use GPS.
        </AppText>
      </View>
      <StatePicker
        value={profile?.state ?? null}
        onChange={(state) =>
          setProfile({ country: DEFAULT_COUNTRY, state, climate_zone: SUGGESTED_ZONE[state] })
        }
      />
      <Button label="Continue" disabled={!profile} onPress={() => router.push('/onboarding/zone')} />
    </Screen>
  );
}
