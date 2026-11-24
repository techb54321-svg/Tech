import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';

import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { formatDate } from '@/lib/location';
import { choosePhoto, takePhoto } from '@/lib/photos';
import { useAppState } from '@/state/app-state';
import { radius, space, useColors } from '@/theme';

const DAY_OPTIONS = [1, 2, 3, 4, 5, 7, 10, 14];

export default function PlantDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plants, updatePlant, addPhoto, removePlant, isPlus } = useAppState();
  const plant = plants.find((p) => p.id === id);
  const [notes, setNotes] = useState(plant?.notes ?? '');

  if (!plant) {
    return (
      <Screen edges={['bottom']}>
        <AppText>This plant is no longer in your garden.</AppText>
      </Screen>
    );
  }

  const addProgressPhoto = () =>
    Alert.alert('Add a progress photo', undefined, [
      { text: 'Take a photo', onPress: async () => { const p = await takePhoto(); if (p) addPhoto(plant.id, p.uri); } },
      { text: 'Choose from photos', onPress: async () => { const p = await choosePhoto(); if (p) addPhoto(plant.id, p.uri); } },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const toggleReminder = (enabled: boolean) => {
    if (enabled && !isPlus) {
      router.push({ pathname: '/paywall', params: { reason: 'reminders' } });
      return;
    }
    updatePlant(plant.id, { reminder: { ...plant.reminder, enabled } });
  };

  const remove = () =>
    Alert.alert(`Remove ${plant.commonName}?`, 'This removes the plant, its notes and its photos from My Garden.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removePlant(plant.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: plant.commonName }} />

      <View style={{ gap: space.xs }}>
        <AppText variant="title">{plant.commonName}</AppText>
        <AppText variant="subheading" tone="muted" style={{ fontStyle: 'italic', fontWeight: '400' }}>
          {plant.scientificName}
        </AppText>
        <AppText variant="small" tone="muted">
          Added {formatDate(plant.createdAt)}
        </AppText>
      </View>

      {/* Progress photos */}
      <View style={{ gap: space.md }}>
        <AppText variant="heading">Progress photos</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
          {plant.photos.map((ph) => (
            <View key={ph.id} style={{ gap: space.xs }}>
              <Image
                source={{ uri: ph.uri }}
                style={{ width: 140, height: 140, borderRadius: radius.md, backgroundColor: c.sand }}
                contentFit="cover"
                accessibilityLabel={`Photo from ${formatDate(ph.createdAt)}`}
              />
              <AppText variant="small" tone="muted">
                {formatDate(ph.createdAt)}
              </AppText>
            </View>
          ))}
          <Pressable
            onPress={addProgressPhoto}
            accessibilityRole="button"
            accessibilityLabel="Add a progress photo"
            style={({ pressed }) => ({
              width: 140,
              height: 140,
              borderRadius: radius.md,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: c.primary,
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.xs,
              opacity: pressed ? 0.6 : 1,
            })}>
            <Ionicons name="add" size={34} color={c.primary} />
            <AppText variant="small" tone="primary" style={{ textAlign: 'center' }}>
              Add photo
            </AppText>
          </Pressable>
        </ScrollView>
      </View>

      {/* Notes */}
      <View style={{ gap: space.md }}>
        <AppText variant="heading">Notes</AppText>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onBlur={() => updatePlant(plant.id, { notes })}
          multiline
          placeholder="Where it's planted, when you fed it, how it's going…"
          placeholderTextColor={c.textMuted}
          accessibilityLabel="Notes"
          style={{
            minHeight: 120,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.md,
            backgroundColor: c.surface,
            color: c.text,
            padding: space.lg,
            fontSize: 17,
            lineHeight: 24,
            textAlignVertical: 'top',
          }}
        />
        {notes !== plant.notes ? (
          <Button label="Save notes" variant="secondary" onPress={() => updatePlant(plant.id, { notes })} />
        ) : null}
      </View>

      {/* Watering reminder */}
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Ionicons name="water-outline" size={26} color={c.primary} />
          <AppText variant="subheading" style={{ flex: 1 }}>
            Watering reminder
          </AppText>
          <Switch
            value={plant.reminder.enabled}
            onValueChange={toggleReminder}
            trackColor={{ true: c.primary, false: c.border }}
            accessibilityLabel="Watering reminder"
          />
        </View>
        {plant.reminder.enabled ? (
          <>
            <AppText>Remind me every:</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {DAY_OPTIONS.map((d) => {
                const on = plant.reminder.everyDays === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => updatePlant(plant.id, { reminder: { ...plant.reminder, everyDays: d } })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${d} ${d === 1 ? 'day' : 'days'}`}
                    style={{
                      minWidth: 56,
                      minHeight: 48,
                      paddingHorizontal: space.md,
                      borderRadius: radius.md,
                      borderWidth: on ? 2 : 1,
                      borderColor: on ? c.primary : c.border,
                      backgroundColor: on ? c.primarySoft : c.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <AppText variant="subheading">{d}</AppText>
                  </Pressable>
                );
              })}
            </View>
            <AppText variant="small" tone="muted">
              {`days. Test version: reminders are saved but won't send a notification until a later update.`}
            </AppText>
          </>
        ) : (
          <AppText variant="small" tone="muted">
            Get a gentle nudge on your phone when it's time to water.
          </AppText>
        )}
      </Card>

      {plant.id.startsWith('sample-') ? (
        <Notice tone="info" icon="information-circle-outline">
          This is a sample plant so you can try My Garden. Remove it whenever you like.
        </Notice>
      ) : null}

      <Button label="Remove from My Garden" variant="outline" icon="trash-outline" onPress={remove} />
    </Screen>
  );
}
