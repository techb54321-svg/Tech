/**
 * The one place screens get their reference data from.
 *
 * PHASE 1: returns built-in sample data.
 * PHASE 2: these functions will read from Supabase instead. Screens won't
 * need to change.
 */
import {
  DECLARED_WEEDS,
  MONTHLY_JOBS,
  NAME_SWAPS,
  PHOSPHORUS_SENSITIVE_GENERA,
  PLANTING_CALENDAR,
  SAMPLE_IDENTIFICATIONS,
  sampleWeedIdentification,
} from '@/data/fake-data';
import type {
  ClimateZone,
  CountryCode,
  MonthlyJobRow,
  PlantingCalendarRow,
  Profile,
  ScanResult,
} from '@/data/types';

import { buildScanResult } from './scan-logic';

export async function getPlantNow(
  country: CountryCode,
  zone: ClimateZone,
  month: number,
): Promise<PlantingCalendarRow[]> {
  return PLANTING_CALENDAR.filter(
    (r) => r.country === country && r.zone === zone && r.months.includes(month),
  ).sort((a, b) => a.crop_name.localeCompare(b.crop_name));
}

export async function getCrop(id: string): Promise<PlantingCalendarRow | null> {
  return PLANTING_CALENDAR.find((r) => r.id === id) ?? null;
}

export async function getJobs(
  country: CountryCode,
  zone: ClimateZone,
  month: number,
): Promise<MonthlyJobRow[]> {
  return MONTHLY_JOBS.filter((r) => r.country === country && r.zone === zone && r.month === month);
}

/**
 * PHASE 1: pretends to identify the photo. It cycles through sample answers
 * so every part of the results screen can be tested:
 *   1st scan: a declared weed in your state (red banner)
 *   2nd scan: an Australian native (phosphorus tip)
 *   3rd scan: an unhealthy capsicum (health problems + name swap)
 *   4th scan: a low-confidence result
 */
export async function identifyPlant(
  imageUri: string,
  profile: Profile,
  sampleIndex: number,
): Promise<ScanResult> {
  await new Promise((r) => setTimeout(r, 1800)); // feels like a real lookup

  const weed = DECLARED_WEEDS.find((w) => w.country === profile.country && w.state === profile.state);
  const samples = [
    weed
      ? sampleWeedIdentification(weed.scientific_name, weed.common_name)
      : sampleWeedIdentification('Lantana camara', 'Lantana'),
    ...SAMPLE_IDENTIFICATIONS,
  ];
  const raw = samples[sampleIndex % samples.length];

  return buildScanResult({
    id: `scan-${Date.now()}`,
    imageUri,
    raw,
    country: profile.country,
    state: profile.state,
    weeds: DECLARED_WEEDS,
    genera: PHOSPHORUS_SENSITIVE_GENERA,
    swaps: NAME_SWAPS,
  });
}
