import { View } from 'react-native';

import type { ClimateZone, StateCode } from '@/data/types';
import { STATES, SUGGESTED_ZONE, ZONES } from '@/lib/location';
import { space } from '@/theme';

import { ChoiceRow } from './ui';

export function StatePicker({ value, onChange }: { value: StateCode | null; onChange: (s: StateCode) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
      {STATES.map((s) => (
        <ChoiceRow
          key={s.code}
          title={s.name}
          subtitle={s.code}
          selected={value === s.code}
          onPress={() => onChange(s.code)}
        />
      ))}
    </View>
  );
}

export function ZonePicker({
  value,
  state,
  onChange,
}: {
  value: ClimateZone | null;
  state: StateCode | null;
  onChange: (z: ClimateZone) => void;
}) {
  const suggested = state ? SUGGESTED_ZONE[state] : null;
  return (
    <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
      {ZONES.map((z) => (
        <ChoiceRow
          key={z.code}
          title={z.name}
          subtitle={`Like ${z.examples}`}
          badge={z.code === suggested ? `Common in ${state}` : undefined}
          selected={value === z.code}
          onPress={() => onChange(z.code)}
        />
      ))}
    </View>
  );
}
