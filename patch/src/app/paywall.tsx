import { router, useLocalSearchParams } from 'expo-router';

import { PaywallView } from '@/components/paywall-view';
import { Screen } from '@/components/ui';

const REASONS: Record<string, string> = {
  plants: 'The free plan holds up to 3 plants. Patch Plus lets you save as many as you like.',
  reminders: 'Watering reminders are part of Patch Plus.',
  scans: "You've used your 3 free scans.",
};

export default function PaywallModal() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  return (
    <Screen edges={['bottom']}>
      <PaywallView reason={REASONS[reason ?? 'scans']} onDone={() => router.back()} />
    </Screen>
  );
}
