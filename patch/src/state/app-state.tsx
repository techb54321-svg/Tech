/**
 * App-wide state, saved on the phone so it survives restarts.
 *
 * PHASE 1: everything lives on the phone (fake subscription, local garden).
 * Later phases move the garden and scan count to Supabase and the
 * subscription to RevenueCat.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { SAMPLE_GARDEN } from '@/data/fake-data';
import type { GardenPlant, Profile, ScanResult } from '@/data/types';

const STORAGE_KEY = 'patch.state.v1';

export const FREE_SCAN_LIMIT = 3;

interface PersistedState {
  onboarded: boolean;
  profile: Profile | null;
  isPlus: boolean;
  scansUsed: number;
  plants: GardenPlant[];
}

const INITIAL: PersistedState = {
  onboarded: false,
  profile: null,
  isPlus: false,
  scansUsed: 0,
  plants: SAMPLE_GARDEN,
};

interface AppState extends PersistedState {
  hydrated: boolean;
  freeScansLeft: number;
  canScan: boolean;
  setProfile: (p: Profile) => void;
  completeOnboarding: () => void;
  recordScan: () => void;
  setPlus: (on: boolean) => void;
  addPlantFromScan: (scan: ScanResult) => GardenPlant;
  updatePlant: (id: string, changes: Partial<GardenPlant>) => void;
  addPhoto: (plantId: string, uri: string) => void;
  removePlant: (id: string) => void;
  resetAll: () => void;
  resetScans: () => void;
}

const Ctx = createContext<AppState | null>(null);

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);

  // Load saved state once at start-up.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setState({ ...INITIAL, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);

  // Save whenever something changes.
  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const patch = useCallback((changes: Partial<PersistedState>) => {
    setState((s) => ({ ...s, ...changes }));
  }, []);

  const value = useMemo<AppState>(() => {
    const freeScansLeft = Math.max(0, FREE_SCAN_LIMIT - state.scansUsed);
    return {
      ...state,
      hydrated,
      freeScansLeft,
      canScan: state.isPlus || freeScansLeft > 0,
      setProfile: (profile) => patch({ profile }),
      completeOnboarding: () => patch({ onboarded: true }),
      recordScan: () => setState((s) => ({ ...s, scansUsed: s.scansUsed + 1 })),
      setPlus: (isPlus) => patch({ isPlus }),
      addPlantFromScan: (scan) => {
        const now = new Date().toISOString();
        const plant: GardenPlant = {
          id: newId('plant'),
          commonName: scan.commonName,
          scientificName: scan.scientificName,
          notes: '',
          createdAt: now,
          photos: [{ id: newId('photo'), uri: scan.imageUri, createdAt: now }],
          reminder: { enabled: false, everyDays: 3 },
        };
        setState((s) => ({ ...s, plants: [plant, ...s.plants] }));
        return plant;
      },
      updatePlant: (id, changes) =>
        setState((s) => ({
          ...s,
          plants: s.plants.map((p) => (p.id === id ? { ...p, ...changes } : p)),
        })),
      addPhoto: (plantId, uri) =>
        setState((s) => ({
          ...s,
          plants: s.plants.map((p) =>
            p.id === plantId
              ? {
                  ...p,
                  photos: [...p.photos, { id: newId('photo'), uri, createdAt: new Date().toISOString() }],
                }
              : p,
          ),
        })),
      removePlant: (id) => setState((s) => ({ ...s, plants: s.plants.filter((p) => p.id !== id) })),
      resetAll: () => setState(INITIAL),
      resetScans: () => patch({ scansUsed: 0 }),
    };
  }, [state, hydrated, patch]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}

/** For screens that only render once onboarding has set a profile. */
export function useProfile(): Profile {
  const { profile } = useAppState();
  return profile ?? { country: 'AU', state: 'VIC', climate_zone: 'temperate' };
}
