import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { AppText, Bullet, Button, Card, Pill, Screen, Section } from '@/components/ui';
import type { MonthlyJobRow, PlantingCalendarRow } from '@/data/types';
import { getJobs, getPlantNow } from '@/lib/data-source';
import { METHODS, MONTHS, currentMonth, zoneName } from '@/lib/location';
import { useProfile } from '@/state/app-state';
import { space } from '@/theme';

export default function Home() {
  const profile = useProfile();
  const month = currentMonth();
  const [crops, setCrops] = useState<PlantingCalendarRow[]>([]);
  const [jobs, setJobs] = useState<MonthlyJobRow[]>([]);

  // Reload whenever the screen is shown, in case the zone was changed.
  useFocusEffect(
    useCallback(() => {
      getPlantNow(profile.country, profile.climate_zone, month).then(setCrops);
      getJobs(profile.country, profile.climate_zone, month).then(setJobs);
    }, [profile.country, profile.climate_zone, month]),
  );

  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <AppText variant="label" tone="primary">
          {`${MONTHS[month - 1]} · ${profile.state} · ${zoneName(profile.climate_zone)}`.toUpperCase()}
        </AppText>
        <AppText variant="title">This month in your garden</AppText>
      </View>

      <Button
        label="Scan a plant"
        icon="camera"
        size="huge"
        onPress={() => router.navigate('/scan')}
        accessibilityHint="Opens the camera to identify a plant"
      />

      <Section title="Plant now">
        {crops.length === 0 ? (
          <Card tone="sand">
            <AppText>Nothing to plant this month in your zone. A good time to rest beds and add compost.</AppText>
          </Card>
        ) : (
          crops.map((crop) => (
            <Card
              key={crop.id}
              onPress={() => router.push({ pathname: '/crop/[id]', params: { id: crop.id } })}
              accessibilityLabel={`${crop.crop_name}, ${METHODS[crop.method].label}`}
              accessibilityHint="Shows planting tips">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <AppText variant="subheading" style={{ flex: 1 }}>
                  {crop.crop_name}
                </AppText>
                <Pill label={METHODS[crop.method].label} />
              </View>
            </Card>
          ))
        )}
      </Section>

      <Section title="Jobs this month">
        <Card tone="sand" style={{ gap: space.md }}>
          {jobs.length === 0 ? (
            <AppText>No jobs listed for this month yet.</AppText>
          ) : (
            jobs.map((j) => (
              <Bullet key={j.id} icon="checkmark-circle-outline" iconSize={22}>
                {j.job}
              </Bullet>
            ))
          )}
        </Card>
      </Section>
    </Screen>
  );
}
