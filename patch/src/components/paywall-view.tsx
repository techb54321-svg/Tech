/**
 * The Patch Plus offer. Honest by design:
 * - price, trial length and first-payment date are always visible
 * - "Not now" is a full-size button, never hidden
 * - no countdown timers or pressure tactics
 *
 * PHASE 1: no real payment. Phase 5 connects RevenueCat.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { addDays, formatLongDate } from '@/lib/location';
import { useAppState } from '@/state/app-state';
import { space, useColors } from '@/theme';

import { AppText, Bullet, Button, ChoiceRow } from './ui';

export const TRIAL_DAYS = 7;

export const PLANS = {
  yearly: { id: 'yearly', title: 'Yearly', price: 'A$49.99', per: 'year', note: 'Works out to A$4.17 a month' },
  monthly: { id: 'monthly', title: 'Monthly', price: 'A$9.99', per: 'month', note: 'Cancel anytime' },
} as const;

type PlanId = keyof typeof PLANS;

const BENEFITS = [
  'Unlimited plant scans and health checks',
  'Save as many plants as you like to My Garden',
  'Watering reminders for each plant',
];

export function PaywallView({ onDone, reason }: { onDone: () => void; reason?: string }) {
  const c = useColors();
  const { setPlus } = useAppState();
  const [plan, setPlan] = useState<PlanId>('yearly');
  const p = PLANS[plan];
  const firstPayment = formatLongDate(addDays(new Date(), TRIAL_DAYS));
  const storeAccount = Platform.OS === 'ios' ? 'Apple Account' : 'Google Play account';

  const start = () => {
    Alert.alert(
      'Test version',
      'No payment is taken in this test version. Patch Plus is now switched on so you can try everything.',
      [
        {
          text: 'OK',
          onPress: () => {
            setPlus(true);
            onDone();
          },
        },
      ],
    );
  };

  const restore = () =>
    Alert.alert('Restore purchases', 'Nothing to restore yet. This will work once subscriptions are set up.');

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: c.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="leaf" size={38} color={c.primary} />
        </View>
        <AppText variant="title" style={{ textAlign: 'center' }}>
          Patch Plus
        </AppText>
        {reason ? (
          <AppText tone="muted" style={{ textAlign: 'center' }}>
            {reason}
          </AppText>
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        {BENEFITS.map((b) => (
          <Bullet key={b} icon="checkmark-circle" iconSize={22}>
            {b}
          </Bullet>
        ))}
        <Bullet icon="checkmark-circle" iconSize={22}>
          The monthly garden guide stays free for everyone
        </Bullet>
      </View>

      <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
        {(Object.keys(PLANS) as PlanId[]).map((id) => (
          <ChoiceRow
            key={id}
            title={`${PLANS[id].title}: ${PLANS[id].price} a ${PLANS[id].per}`}
            subtitle={PLANS[id].note}
            badge={id === 'yearly' ? 'Best value' : undefined}
            selected={plan === id}
            onPress={() => setPlan(id)}
          />
        ))}
      </View>

      <View style={{ backgroundColor: c.sand, borderRadius: 14, padding: space.lg, gap: space.xs }}>
        <AppText variant="subheading">
          {TRIAL_DAYS} days free, then {p.price} a {p.per}
        </AppText>
        <AppText>First payment: {firstPayment}</AppText>
        <AppText variant="small" tone="muted">
          Cancel anytime before then and you won't be charged. We'll remind you 2 days before your
          trial ends.
        </AppText>
      </View>

      <View style={{ gap: space.md }}>
        <Button label={`Start ${TRIAL_DAYS}-day free trial`} onPress={start} />
        <Button label="Not now" variant="outline" onPress={onDone} />
        <Button label="Restore purchases" variant="ghost" onPress={restore} />
      </View>

      <AppText variant="small" tone="muted">
        Payment is charged to your {storeAccount} when the trial ends. The subscription renews
        automatically unless you cancel at least 24 hours before the end of the current period. You
        can manage or cancel it anytime in Patch's Settings.
      </AppText>
    </View>
  );
}
