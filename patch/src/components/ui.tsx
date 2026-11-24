/**
 * Shared building blocks. All text scales with the phone's text-size
 * setting, buttons are large, and everything has screen-reader labels.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { radius, space, useColors, type Palette } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------- Text ----------

type Variant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'small' | 'label';
type Tone = 'default' | 'muted' | 'primary' | 'danger' | 'onPrimary';

const variantStyles: Record<Variant, object> = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  subheading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 25 },
  small: { fontSize: 15, lineHeight: 21 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600', letterSpacing: 0.3 },
};

function toneColor(c: Palette, tone: Tone) {
  switch (tone) {
    case 'muted':
      return c.textMuted;
    case 'primary':
      return c.primary;
    case 'danger':
      return c.danger;
    case 'onPrimary':
      return c.onPrimary;
    default:
      return c.text;
  }
}

export function AppText({
  variant = 'body',
  tone = 'default',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const c = useColors();
  const isHeader = variant === 'display' || variant === 'title' || variant === 'heading';
  return (
    <Text
      accessibilityRole={isHeader ? 'header' : undefined}
      style={[variantStyles[variant], { color: toneColor(c, tone) }, style]}
      {...rest}
    />
  );
}

// ---------- Layout ----------

export function Screen({
  children,
  edges = ['top'],
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  edges?: Edge[];
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const inner = [styles.screenContent, contentStyle];
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.background }}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  onPress,
  tone = 'surface',
  style,
  accessibilityLabel,
  accessibilityHint,
}: {
  children: ReactNode;
  onPress?: () => void;
  tone?: 'surface' | 'sand' | 'primarySoft';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const c = useColors();
  const bg = tone === 'sand' ? c.sand : tone === 'primarySoft' ? c.primarySoft : c.surface;
  const base = [styles.card, { backgroundColor: bg, borderColor: c.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [base, pressed && { opacity: 0.75 }]}>
      {children}
    </Pressable>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.sectionHeader}>
        <AppText variant="heading" style={{ flex: 1 }}>
          {title}
        </AppText>
        {action}
      </View>
      {children}
    </View>
  );
}

// ---------- Buttons ----------

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  size = 'large',
  disabled,
  loading,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  size?: 'large' | 'huge';
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const colors: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    secondary: { bg: c.sand, fg: c.text, border: c.sandStrong },
    outline: { bg: 'transparent', fg: c.primary, border: c.primary },
    danger: { bg: c.danger, fg: c.onDanger, border: c.danger },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent' },
  };
  const v = colors[variant];
  const huge = size === 'huge';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          minHeight: huge ? 72 : 56,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={huge ? 28 : 22} color={v.fg} /> : null}
          <Text style={[styles.buttonText, { color: v.fg, fontSize: huge ? 20 : 17 }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// ---------- Choice row (radio-style) ----------

export function ChoiceRow({
  title,
  subtitle,
  selected,
  onPress,
  badge,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  badge?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={[title, subtitle, badge].filter(Boolean).join('. ')}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? c.primarySoft : c.surface,
          borderColor: selected ? c.primary : c.border,
          borderWidth: selected ? 2 : 1,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          <AppText variant="subheading">{title}</AppText>
          {badge ? <Pill label={badge} /> : null}
        </View>
        {subtitle ? (
          <AppText variant="small" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={26}
        color={selected ? c.primary : c.textMuted}
      />
    </Pressable>
  );
}

// ---------- Small bits ----------

export function Pill({ label, tone = 'primary' }: { label: string; tone?: 'primary' | 'sand' | 'danger' }) {
  const c = useColors();
  const bg = tone === 'danger' ? c.dangerSoft : tone === 'sand' ? c.sand : c.primarySoft;
  const fg = tone === 'danger' ? c.onDangerSoft : tone === 'sand' ? c.text : c.onPrimarySoft;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** Coloured message box. */
export function Notice({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'danger' | 'warning' | 'success' | 'info';
  icon?: IconName;
  title?: string;
  children?: ReactNode;
}) {
  const c = useColors();
  const map = {
    danger: { bg: c.danger, fg: c.onDanger, border: c.danger },
    warning: { bg: c.warningSoft, fg: c.onWarningSoft, border: c.warningSoft },
    success: { bg: c.primarySoft, fg: c.onPrimarySoft, border: c.primarySoft },
    info: { bg: c.sand, fg: c.text, border: c.sandStrong },
  }[tone];
  return (
    <View
      accessible
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      style={[styles.notice, { backgroundColor: map.bg, borderColor: map.border }]}>
      {icon ? <Ionicons name={icon} size={26} color={map.fg} style={{ marginTop: 1 }} /> : null}
      <View style={{ flex: 1, gap: space.xs }}>
        {title ? (
          <Text style={{ color: map.fg, fontSize: 18, lineHeight: 24, fontWeight: '700' }}>{title}</Text>
        ) : null}
        {isPlainText(children) ? (
          <Text style={{ color: map.fg, fontSize: 16, lineHeight: 23 }}>{children}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

/** True for "text", 42, or a mix like {"only "}{pct}{"% sure"}. */
function isPlainText(node: ReactNode): boolean {
  if (typeof node === 'string' || typeof node === 'number') return true;
  return Array.isArray(node) && node.every((n) => typeof n === 'string' || typeof n === 'number');
}

/** Text inside a Notice that needs the notice's own colour. */
export function NoticeText({ children, tone }: { children: ReactNode; tone: 'danger' | 'warning' | 'success' | 'info' }) {
  const c = useColors();
  const fg = { danger: c.onDanger, warning: c.onWarningSoft, success: c.onPrimarySoft, info: c.text }[tone];
  return <Text style={{ color: fg, fontSize: 16, lineHeight: 23 }}>{children}</Text>;
}

export function Bullet({ children, icon = 'ellipse', iconSize = 8 }: { children: ReactNode; icon?: IconName; iconSize?: number }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
      <View style={{ minHeight: 25, justifyContent: 'center' }}>
        <Ionicons name={icon} size={iconSize} color={c.primary} />
      </View>
      <AppText style={{ flex: 1 }}>{children}</AppText>
    </View>
  );
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

/** Settings-style row with a chevron. */
export function ListRow({
  icon,
  title,
  value,
  onPress,
  tone = 'default',
}: {
  icon: IconName;
  title: string;
  value?: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  const c = useColors();
  const color = tone === 'danger' ? c.danger : c.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
      style={({ pressed }) => [styles.listRow, { opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name={icon} size={24} color={tone === 'danger' ? c.danger : c.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color, fontSize: 17, lineHeight: 23 }}>{title}</Text>
        {value ? (
          <Text style={{ color: c.textMuted, fontSize: 15, lineHeight: 21 }}>{value}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
    </Pressable>
  );
}

export const PLANT_ID_DISCLAIMER =
  'Plant ID can be wrong. Never eat a plant or mushroom based on this app.';

export function Disclaimer() {
  return (
    <Notice tone="info" icon="information-circle-outline">
      {PLANT_ID_DISCLAIMER}
    </Notice>
  );
}

const styles = StyleSheet.create({
  screenContent: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.lg,
    gap: space.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  button: {
    borderRadius: radius.md,
    borderWidth: 2,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonText: { fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  choice: {
    borderRadius: radius.md,
    padding: space.lg,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  notice: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.lg,
    flexDirection: 'row',
    gap: space.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingVertical: space.sm,
  },
});
