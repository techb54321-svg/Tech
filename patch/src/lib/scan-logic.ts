/**
 * The rules that turn a raw plant identification into what Patch shows.
 * Pure functions with no app or network code, so the same rules can run
 * on the server (Supabase Edge Function) in Phase 3.
 */
import type {
  CountryCode,
  DeclaredWeedRow,
  NameSwapRow,
  PhosphorusGenusRow,
  RawIdentification,
  ScanResult,
  StateCode,
} from '@/data/types';

/** Below this, we tell the person the ID is uncertain. */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

/** "Lantana camara var. aculeata" → "lantana camara" */
export function genusSpecies(scientificName: string): string {
  return scientificName.trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase();
}

export function genusOf(scientificName: string): string {
  return scientificName.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
}

export function applyNameSwap(
  commonName: string,
  country: CountryCode,
  swaps: NameSwapRow[],
): string {
  const key = commonName.trim().toLowerCase();
  const match = swaps.find((s) => s.country === country && s.from_name.trim().toLowerCase() === key);
  return match ? match.to_name : commonName;
}

export function findDeclaredWeed(
  scientificName: string,
  country: CountryCode,
  state: StateCode,
  weeds: DeclaredWeedRow[],
): DeclaredWeedRow | null {
  const key = genusSpecies(scientificName);
  if (!key.includes(' ')) return null; // need both genus and species
  return (
    weeds.find(
      (w) => w.country === country && w.state === state && genusSpecies(w.scientific_name) === key,
    ) ?? null
  );
}

export function findPhosphorusTip(
  scientificName: string,
  genera: PhosphorusGenusRow[],
): PhosphorusGenusRow | null {
  const genus = genusOf(scientificName);
  return genera.find((g) => g.genus.trim().toLowerCase() === genus) ?? null;
}

export function buildScanResult(args: {
  id: string;
  imageUri: string;
  raw: RawIdentification;
  country: CountryCode;
  state: StateCode;
  weeds: DeclaredWeedRow[];
  genera: PhosphorusGenusRow[];
  swaps: NameSwapRow[];
  now?: Date;
}): ScanResult {
  const { raw } = args;
  const commonName = applyNameSwap(raw.commonName, args.country, args.swaps);
  return {
    id: args.id,
    createdAt: (args.now ?? new Date()).toISOString(),
    imageUri: args.imageUri,
    commonName,
    originalCommonName: commonName !== raw.commonName ? raw.commonName : undefined,
    scientificName: raw.scientificName,
    confidence: raw.confidence,
    lowConfidence: raw.confidence < LOW_CONFIDENCE_THRESHOLD,
    description: raw.description,
    light: raw.light,
    water: raw.water,
    isHealthy: raw.isHealthy,
    problems: [...raw.problems].sort((a, b) => b.probability - a.probability),
    weed: findDeclaredWeed(raw.scientificName, args.country, args.state, args.weeds),
    phosphorusTip: findPhosphorusTip(raw.scientificName, args.genera),
  };
}

/** Plain words instead of a bare percentage. */
export function likelihoodWord(probability: number): string {
  if (probability >= 0.6) return 'Likely';
  if (probability >= 0.3) return 'Possible';
  return 'Less likely';
}
