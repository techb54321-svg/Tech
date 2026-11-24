import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, Linking, Platform, View } from 'react-native';

import { AppText, Button, Card, Divider, ListRow, Notice, Screen, Section } from '@/components/ui';
import { stateName, zoneName } from '@/lib/location';
import { FREE_SCAN_LIMIT, useAppState, useProfile } from '@/state/app-state';
import { space } from '@/theme';

// Placeholder until a real support address is set up (Phase 6).
const CONTACT_EMAIL = 'hello@example.com';

const MANAGE_SUBSCRIPTION_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';

const HOW_TO_CANCEL =
  Platform.OS === 'ios'
    ? 'To cancel on iPhone: tap the button above, or open the Settings app, tap your name, then Subscriptions, then Patch, then Cancel Subscription. You keep Patch Plus until the end of the period you have paid for.'
    : 'To cancel on Android: tap the button above, or open the Play Store app, tap your profile picture, then Payments & subscriptions, then Subscriptions, then Patch, then Cancel subscription. You keep Patch Plus until the end of the period you have paid for.';

export default function Settings() {
  const profile = useProfile();
  const { isPlus, freeScansLeft, setPlus, resetAll, resetScans } = useAppState();

  const comingSoon = (what: string) =>
    Alert.alert(what, 'This page will be ready before the app is released.');

  const deleteAccount = () =>
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account, your saved plants, your photos and your scan history. It cannot be undone.\n\nIf you have a subscription, cancel it separately first, or you may keep being charged.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            resetAll();
            Alert.alert('Account deleted', 'Test version: your local data has been cleared.');
          },
        },
      ],
    );

  return (
    <Screen>
      <AppText variant="title">Settings</AppText>

      <Section title="Your garden">
        <Card>
          <ListRow
            icon="location-outline"
            title="State or territory"
            value={stateName(profile.state)}
            onPress={() => router.push('/change-location')}
          />
          <Divider />
          <ListRow
            icon="partly-sunny-outline"
            title="Climate zone"
            value={zoneName(profile.climate_zone)}
            onPress={() => router.push('/change-location')}
          />
        </Card>
      </Section>

      <Section title="Subscription">
        <Card style={{ gap: space.md }}>
          <AppText variant="subheading">{isPlus ? 'Patch Plus' : 'Free plan'}</AppText>
          <AppText tone="muted">
            {isPlus
              ? 'Unlimited scans, unlimited plants and watering reminders.'
              : `${freeScansLeft} of ${FREE_SCAN_LIMIT} free scans left. The monthly guide is always free.`}
          </AppText>
          {!isPlus ? <Button label="See Patch Plus" onPress={() => router.push('/paywall')} /> : null}
          <Button
            label="Manage or cancel subscription"
            variant="secondary"
            onPress={() => Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
          />
          <AppText variant="small" tone="muted">
            {HOW_TO_CANCEL}
          </AppText>
          <Button
            label="Restore purchases"
            variant="ghost"
            onPress={() =>
              Alert.alert('Restore purchases', 'Nothing to restore yet. This will work once subscriptions are set up.')
            }
          />
        </Card>
      </Section>

      <Section title="About">
        <Card>
          <ListRow icon="shield-checkmark-outline" title="Privacy policy" onPress={() => comingSoon('Privacy policy')} />
          <Divider />
          <ListRow icon="document-text-outline" title="Terms of use" onPress={() => comingSoon('Terms of use')} />
          <Divider />
          <ListRow
            icon="mail-outline"
            title="Contact us"
            onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=Patch%20app`)}
          />
        </Card>
      </Section>

      <Section title="Account">
        <Card>
          <ListRow icon="trash-outline" title="Delete account" tone="danger" onPress={deleteAccount} />
        </Card>
      </Section>

      {/* Only for testing Phase 1. Removed before release. */}
      <Section title="Testing tools">
        <Notice tone="warning" icon="construct-outline">
          These buttons are only in the test version, to help you try things out.
        </Notice>
        <View style={{ gap: space.md }}>
          <Button
            label={isPlus ? 'Switch to Free plan' : 'Switch to Patch Plus'}
            variant="secondary"
            onPress={() => setPlus(!isPlus)}
          />
          <Button label="Reset free scans" variant="secondary" onPress={resetScans} />
          <Button label="Start again from the welcome screen" variant="secondary" onPress={resetAll} />
        </View>
      </Section>

      <AppText variant="small" tone="muted" style={{ textAlign: 'center' }}>
        Patch {Constants.expoConfig?.version ?? ''}
      </AppText>
    </Screen>
  );
}

