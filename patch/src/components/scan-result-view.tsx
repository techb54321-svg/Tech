import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, Text, View } from 'react-native';

import type { ScanResult } from '@/data/types';
import { stateName } from '@/lib/location';
import { likelihoodWord } from '@/lib/scan-logic';
import { radius, space, useColors } from '@/theme';

import { AppText, Bullet, Button, Card, Disclaimer, Notice, NoticeText, Pill } from './ui';

export function ScanResultView({
  result,
  onSave,
  onScanAgain,
  saved,
}: {
  result: ScanResult;
  onSave: () => void;
  onScanAgain: () => void;
  saved: boolean;
}) {
  const c = useColors();
  const pct = Math.round(result.confidence * 100);

  return (
    <View style={{ gap: space.xl }}>
      <Image
        source={{ uri: result.imageUri }}
        style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: c.sand }}
        contentFit="cover"
        accessibilityLabel="Your plant photo"
      />

      {/* Name */}
      <View style={{ gap: space.xs }}>
        <AppText variant="title">{result.commonName}</AppText>
        <AppText variant="subheading" tone="muted" style={{ fontStyle: 'italic', fontWeight: '400' }}>
          {result.scientificName}
        </AppText>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: space.xs }}>
          <Pill label={`${pct}% match`} tone={result.lowConfidence ? 'sand' : 'primary'} />
          {result.originalCommonName ? (
            <Pill label={`Also called ${result.originalCommonName.toLowerCase()}`} tone="sand" />
          ) : null}
        </View>
      </View>

      {/* Declared weed */}
      {result.weed ? (
        <Notice tone="danger" icon="warning" title={`Declared weed in ${stateName(result.weed.state)}`}>
          <View style={{ gap: space.sm }}>
            <NoticeText tone="danger">{result.weed.status_note}</NoticeText>
            <NoticeText tone="danger">
              Rules can differ by area. Check the official list or your local council.
            </NoticeText>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open the official ${result.weed.state} weed information`}
              onPress={() => WebBrowser.openBrowserAsync(result.weed!.official_url)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
              <Text style={{ color: c.onDanger, fontSize: 16, fontWeight: '700', textDecorationLine: 'underline' }}>
                See the official information
              </Text>
              <Ionicons name="open-outline" size={18} color={c.onDanger} />
            </Pressable>
          </View>
        </Notice>
      ) : null}

      {/* Low confidence */}
      {result.lowConfidence ? (
        <Notice tone="warning" icon="help-circle" title="We're not sure about this one">
          This is our best guess, but we're only {pct}% sure. For a better result, take a clearer
          close-up of a leaf or flower in good light.
        </Notice>
      ) : null}

      {/* Native care */}
      {result.phosphorusTip ? (
        <Notice tone="success" icon="leaf" title="Native plant care">
          <View style={{ gap: space.xs }}>
            <NoticeText tone="success">
              This plant is sensitive to phosphorus. Use a low-phosphorus native fertiliser, not a
              general one.
            </NoticeText>
            {result.phosphorusTip.note ? (
              <NoticeText tone="success">{result.phosphorusTip.note}</NoticeText>
            ) : null}
          </View>
        </Notice>
      ) : null}

      {/* About */}
      <Card>
        <AppText variant="subheading">About this plant</AppText>
        <AppText>{result.description}</AppText>
        {result.light ? <InfoRow icon="sunny-outline" label="Light" value={result.light} /> : null}
        {result.water ? <InfoRow icon="water-outline" label="Water" value={result.water} /> : null}
      </Card>

      {/* Health */}
      {result.isHealthy ? (
        <Notice tone="success" icon="checkmark-circle" title="Looks healthy">
          We didn't spot any problems in this photo.
        </Notice>
      ) : (
        <View style={{ gap: space.md }}>
          <AppText variant="heading">Possible problems</AppText>
          {result.problems.map((p) => (
            <Card key={p.name}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                <AppText variant="subheading">{p.name}</AppText>
                <Pill label={likelihoodWord(p.probability)} tone="sand" />
              </View>
              <AppText tone="muted">{p.description}</AppText>
              <AppText variant="label" style={{ marginTop: space.xs }}>
                WHAT TO DO
              </AppText>
              {p.steps.map((s, i) => (
                <Bullet key={i}>{s}</Bullet>
              ))}
            </Card>
          ))}
        </View>
      )}

      <View style={{ gap: space.md }}>
        <Button
          label={saved ? 'Saved to My Garden' : 'Save to My Garden'}
          icon={saved ? 'checkmark' : 'add-circle-outline'}
          onPress={onSave}
          disabled={saved}
        />
        <Button label="Scan again" icon="camera-outline" variant="secondary" onPress={onScanAgain} />
      </View>

      <Disclaimer />
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: 'sunny-outline' | 'water-outline'; label: string; value: string }) {
  const c = useColors();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', marginTop: space.xs }}>
      <Ionicons name={icon} size={24} color={c.primary} />
      <View style={{ flex: 1 }}>
        <AppText variant="label" tone="muted">
          {label.toUpperCase()}
        </AppText>
        <AppText>{value}</AppText>
      </View>
    </View>
  );
}
