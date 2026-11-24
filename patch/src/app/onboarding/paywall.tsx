import { PaywallView } from '@/components/paywall-view';
import { Screen } from '@/components/ui';
import { useAppState } from '@/state/app-state';

export default function OnboardingPaywall() {
  const { completeOnboarding } = useAppState();
  // Finishing onboarding switches the app over to the main tabs.
  return (
    <Screen edges={['bottom']}>
      <PaywallView
        reason="You get 3 free scans to try Patch. The monthly garden guide is always free."
        onDone={completeOnboarding}
      />
    </Screen>
  );
}
