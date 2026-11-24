import type { ClimateZone, PlantingMethod, StateCode } from '@/data/types';

export const DEFAULT_COUNTRY = 'AU';

export const STATES: { code: StateCode; name: string }[] = [
  { code: 'VIC', name: 'Victoria' },
  { code: 'NSW', name: 'New South Wales' },
  { code: 'QLD', name: 'Queensland' },
  { code: 'SA', name: 'South Australia' },
  { code: 'WA', name: 'Western Australia' },
  { code: 'TAS', name: 'Tasmania' },
  { code: 'NT', name: 'Northern Territory' },
  { code: 'ACT', name: 'Australian Capital Territory' },
];

export const ZONES: { code: ClimateZone; name: string; examples: string }[] = [
  { code: 'tropical', name: 'Tropical', examples: 'Darwin, Cairns' },
  { code: 'subtropical', name: 'Subtropical', examples: 'Brisbane, Gold Coast' },
  { code: 'arid', name: 'Arid', examples: 'Alice Springs, Broken Hill' },
  { code: 'temperate', name: 'Temperate', examples: 'Sydney, Melbourne, Adelaide, Perth' },
  { code: 'cool', name: 'Cool', examples: 'Canberra, Hobart, mountain areas' },
];

/** A sensible starting suggestion. People can always pick another zone. */
export const SUGGESTED_ZONE: Record<StateCode, ClimateZone> = {
  VIC: 'temperate',
  NSW: 'temperate',
  QLD: 'subtropical',
  SA: 'temperate',
  WA: 'temperate',
  TAS: 'cool',
  NT: 'tropical',
  ACT: 'cool',
};

export const METHODS: Record<PlantingMethod, { label: string; explainer: string }> = {
  sow_direct: {
    label: 'Sow direct',
    explainer: 'Sow the seeds straight into your garden bed or pot.',
  },
  seed_tray: {
    label: 'Seed tray',
    explainer:
      'Start the seeds in a seed tray or punnet, then plant them out when they are about 5–10 cm tall.',
  },
  seedling: {
    label: 'Seedling',
    explainer: 'Buy a seedling from your local nursery and plant it out.',
  },
};

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function stateName(code: StateCode): string {
  return STATES.find((s) => s.code === code)?.name ?? code;
}

export function zoneName(code: ClimateZone): string {
  return ZONES.find((z) => z.code === code)?.name ?? code;
}

/** 1 = January … 12 = December */
export function currentMonth(date = new Date()): number {
  return date.getMonth() + 1;
}

/** "24 November 2026" */
export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Tuesday 1 December 2026" */
export function formatLongDate(d: Date): string {
  return `${DAYS[d.getDay()]} ${formatDate(d)}`;
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Turns [9,10,11,12,1] into "September to January". */
export function describeMonths(months: number[]): string {
  if (months.length === 12) return 'All year round';
  const sorted = [...months].sort((a, b) => a - b);
  // Group into runs, allowing a run to wrap from December to January.
  const runs: number[][] = [];
  for (const m of sorted) {
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === m - 1) last.push(m);
    else runs.push([m]);
  }
  if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1].at(-1) === 12) {
    const first = runs.shift()!;
    runs[runs.length - 1].push(...first);
  }
  return runs
    .map((r) =>
      r.length === 1 ? MONTHS[r[0] - 1] : `${MONTHS[r[0] - 1]} to ${MONTHS[r[r.length - 1] - 1]}`,
    )
    .join(', ');
}
