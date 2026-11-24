import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText, Button, Card, Pill, Screen } from '@/components/ui';
import { formatDate } from '@/lib/location';
import { useAppState } from '@/state/app-state';
import { radius, space, useColors } from '@/theme';

export default function Garden() {
  const c = useColors();
  const { plants } = useAppState();

  return (
    <Screen>
      <View style={{ gap: space.sm }}>
        <AppText variant="title">My Garden</AppText>
        <AppText tone="muted">
          {plants.length === 0
            ? 'Plants you save from a scan will appear here.'
            : `${plants.length} ${plants.length === 1 ? 'plant' : 'plants'}. Tap one to add notes, photos or a watering reminder.`}
        </AppText>
      </View>

      {plants.length === 0 ? (
        <Card tone="sand" style={{ alignItems: 'center', paddingVertical: space.xxl, gap: space.md }}>
          <Ionicons name="leaf-outline" size={48} color={c.primary} />
          <AppText style={{ textAlign: 'center' }}>Your garden is empty for now.</AppText>
          <Button label="Scan a plant" icon="camera" onPress={() => router.navigate('/scan')} />
        </Card>
      ) : (
        plants.map((p) => {
          const cover = p.photos[p.photos.length - 1];
          return (
            <Card
              key={p.id}
              onPress={() => router.push({ pathname: '/plant/[id]', params: { id: p.id } })}
              accessibilityLabel={`${p.commonName}, added ${formatDate(p.createdAt)}`}
              accessibilityHint="Opens plant details">
              <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
                {cover ? (
                  <Image
                    source={{ uri: cover.uri }}
                    style={{ width: 76, height: 76, borderRadius: radius.sm, backgroundColor: c.sand }}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: radius.sm,
                      backgroundColor: c.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="leaf" size={34} color={c.primary} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="subheading">{p.commonName}</AppText>
                  <AppText variant="small" tone="muted" style={{ fontStyle: 'italic' }}>
                    {p.scientificName}
                  </AppText>
                  <AppText variant="small" tone="muted">
                    Added {formatDate(p.createdAt)}
                  </AppText>
                  {p.reminder.enabled ? (
                    <View style={{ marginTop: space.xs }}>
                      <Pill label={`Water every ${p.reminder.everyDays} days`} />
                    </View>
                  ) : null}
                </View>
              </View>
              {p.notes ? (
                <AppText variant="small" numberOfLines={2}>
                  {p.notes}
                </AppText>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
