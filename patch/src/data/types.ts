/**
 * Shapes of the data Patch uses. These match the Supabase tables planned
 * for Phase 2, so swapping the fake data for the real database is simple.
 *
 * Location-based tables always carry a `country` code so more countries
 * can be added later just by adding rows.
 */

export type CountryCode = string; // e.g. 'AU'

export type StateCode = 'VIC' | 'NSW' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'NT' | 'ACT';

export type ClimateZone = 'tropical' | 'subtropical' | 'arid' | 'temperate' | 'cool';

export type PlantingMethod = 'sow_direct' | 'seed_tray' | 'seedling';

export interface Profile {
  country: CountryCode;
  state: StateCode;
  climate_zone: ClimateZone;
}

/** planting_calendar table */
export interface PlantingCalendarRow {
  id: string;
  country: CountryCode;
  zone: ClimateZone;
  crop_name: string;
  months: number[]; // 1 = January … 12 = December
  method: PlantingMethod;
  tip: string;
}

/** monthly_jobs table */
export interface MonthlyJobRow {
  id: string;
  country: CountryCode;
  zone: ClimateZone;
  month: number;
  job: string;
}

/** declared_weeds table */
export interface DeclaredWeedRow {
  id: string;
  country: CountryCode;
  state: StateCode;
  scientific_name: string;
  common_name: string;
  status_note: string;
  official_url: string;
}

/** phosphorus_sensitive_genera table */
export interface PhosphorusGenusRow {
  id: string;
  genus: string;
  note: string;
}

/** name_swaps table */
export interface NameSwapRow {
  id: string;
  country: CountryCode;
  from_name: string;
  to_name: string;
}

/** What the plant-ID service tells us (simplified). */
export interface RawIdentification {
  commonName: string;
  scientificName: string;
  confidence: number; // 0 to 1
  description: string;
  light?: string;
  water?: string;
  isHealthy: boolean;
  healthyProbability: number; // 0 to 1
  problems: HealthProblem[];
}

export interface HealthProblem {
  name: string;
  probability: number; // 0 to 1
  description: string;
  /** Simple next steps, non-chemical options first. */
  steps: string[];
}

/** A finished scan, ready to show on the results screen. */
export interface ScanResult {
  id: string;
  createdAt: string; // ISO date
  imageUri: string;
  commonName: string;
  /** The name before any Australian name swap, if it changed. */
  originalCommonName?: string;
  scientificName: string;
  confidence: number;
  lowConfidence: boolean;
  description: string;
  light?: string;
  water?: string;
  isHealthy: boolean;
  problems: HealthProblem[];
  weed: DeclaredWeedRow | null;
  phosphorusTip: PhosphorusGenusRow | null;
}

export interface PlantPhoto {
  id: string;
  uri: string;
  createdAt: string;
}

export interface WateringReminder {
  enabled: boolean;
  everyDays: number;
}

/** A plant saved in My Garden. */
export interface GardenPlant {
  id: string;
  commonName: string;
  scientificName: string;
  notes: string;
  createdAt: string;
  photos: PlantPhoto[];
  reminder: WateringReminder;
}
