import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { ScanResultView } from '@/components/scan-result-view';
import { AppText, Bullet, Button, Card, Disclaimer, Notice, Screen } from '@/components/ui';
import type { ScanResult } from '@/data/types';
import { identifyPlant } from '@/lib/data-source';
import { choosePhoto, takePhoto, type PickedPhoto } from '@/lib/photos';
import { FREE_SCAN_LIMIT, useAppState, useProfile } from '@/state/app-state';
import { radius, space, useColors } from '@/theme';

type Stage =
  | { kind: 'idle' }
  | { kind: 'working'; photo: PickedPhoto }
  | { kind: 'result'; result: ScanResult; saved: boolean };

export default function Scan() {
  const c = useColors();
  const profile = useProfile();
  const { canScan, isPlus, freeScansLeft, scansUsed, recordScan, addPlantFromScan, plants } = useAppState();
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });

  const run = async (getPhoto: () => Promise<PickedPhoto | null>) => {
    if (!canScan) {
      router.push('/paywall');
      return;
    }
    let photo: PickedPhoto | null = null;
    try {
      photo = await getPhoto();
    } catch {
      Alert.alert('Something went wrong', "We couldn't open that photo. Please try again.");
      return;
    }
    if (!photo) return;
    setStage({ kind: 'working', photo });
    try {
      const result = await identifyPlant(photo.uri, profile, scansUsed);
      recordScan();
      setStage({ kind: 'result', result, saved: false });
    } catch {
      setStage({ kind: 'idle' });
      Alert.alert('Scan failed', 'Please check your internet connection and try again.');
    }
  };

  const save = () => {
    if (stage.kind !== 'result') return;
    if (!isPlus && plants.length >= FREE_SCAN_LIMIT) {
      router.push({ pathname: '/paywall', params: { reason: 'plants' } });
      return;
    }
    addPlantFromScan(stage.result);
    setStage({ ...stage, saved: true });
    Alert.alert('Saved', `${stage.result.commonName} is now in My Garden.`, [
      { text: 'Stay here' },
      { text: 'Go to My Garden', onPress: () => router.navigate('/garden') },
    ]);
  };

  if (stage.kind === 'working') {
    return (
      <Screen>
        <Image
          source={{ uri: stage.photo.uri }}
          style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: c.sand }}
          contentFit="cover"
          accessibilityLabel="Your plant photo"
        />
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={c.primary} />
          <AppText variant="subheading">Taking a close look…</AppText>
        </View>
      </Screen>
    );
  }

  if (stage.kind === 'result') {
    return (
      <Screen>
        <ScanResultView
          result={stage.result}
          saved={stage.saved}
          onSave={save}
          onScanAgain={() => setStage({ kind: 'idle' })}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: space.sm }}>
        <AppText variant="title">Scan a plant</AppText>
        <AppText tone="muted">
          Take a photo or choose one, and we'll tell you what it is, whether it looks healthy, and what
          to do next.
        </AppText>
      </View>

      <View style={{ gap: space.md }}>
        <Button label="Take a photo" icon="camera" size="huge" onPress={() => run(takePhoto)} />
        <Button label="Choose from photos" icon="images-outline" variant="secondary" onPress={() => run(choosePhoto)} />
      </View>

      {!isPlus ? (
        canScan ? (
          <Notice tone="info" icon="sparkles-outline">
            {`You have ${freeScansLeft} of ${FREE_SCAN_LIMIT} free scans left.`}
          </Notice>
        ) : (
          <Notice tone="warning" icon="lock-closed-outline" title="You've used your free scans">
            Patch Plus gives you unlimited scans and health checks. Tap a button above to see the options.
          </Notice>
        )
      ) : null}

      <Card tone="sand">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Ionicons name="bulb-outline" size={22} color={c.primary} />
          <AppText variant="subheading">Tips for a good photo</AppText>
        </View>
        <Bullet>Get close to a leaf, flower or fruit.</Bullet>
        <Bullet>Use daylight and avoid harsh shadows.</Bullet>
        <Bullet>Keep just one plant in the photo.</Bullet>
      </Card>

      <Disclaimer />
    </Screen>
  );
}
