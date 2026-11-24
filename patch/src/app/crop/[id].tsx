import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText, Card, Pill, Screen } from '@/components/ui';
import type { PlantingCalendarRow } from '@/data/types';
import { getCrop } from '@/lib/data-source';
import { METHODS, describeMonths, zoneName } from '@/lib/location';
import { space } from '@/theme';

export default function CropDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [crop, setCrop] = useState<PlantingCalendarRow | null>(null);

  useEffect(() => {
    getCrop(id).then(setCrop);
  }, [id]);

  if (!crop) return <Screen edges={['bottom']}>{null}</Screen>;
  const method = METHODS[crop.method];

  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: space.sm }}>
        <AppText variant="title">{crop.crop_name}</AppText>
        <Pill label={method.label} />
      </View>
      <Card>
        <AppText variant="label" tone="muted">HOW TO PLANT</AppText>
        <AppText>{method.explainer}</AppText>
      </Card>
      <Card>
        <AppText variant="label" tone="muted">WHEN TO PLANT ({zoneName(crop.zone).toUpperCase()})</AppText>
        <AppText>{describeMonths(crop.months)}</AppText>
      </Card>
      <Card tone="primarySoft">
        <AppText variant="label" tone="primary">TIP</AppText>
        <AppText>{crop.tip}</AppText>
      </Card>
    </Screen>
  );
}
