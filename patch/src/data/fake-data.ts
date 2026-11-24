/**
 * PHASE 1 SAMPLE DATA — for testing the screens only.
 *
 * In Phase 2 this is replaced by the Supabase database. The weed entries
 * here are examples, NOT an official list: the real list must come from
 * each state's official website before launch.
 */
import type {
  ClimateZone,
  DeclaredWeedRow,
  GardenPlant,
  MonthlyJobRow,
  NameSwapRow,
  PhosphorusGenusRow,
  PlantingCalendarRow,
  PlantingMethod,
  RawIdentification,
} from './types';

// ---------- Planting calendar ----------

type CropSeed = [crop: string, months: number[], method: PlantingMethod, tip: string];

const CROPS: Record<ClimateZone, CropSeed[]> = {
  temperate: [
    ['Tomato', [9, 10, 11, 12], 'seedling', 'Plant deep, up to the first leaves, and add a stake on day one.'],
    ['Basil', [10, 11, 12, 1], 'seedling', 'Loves warmth. Pinch out the tips to keep it bushy.'],
    ['Capsicum', [10, 11, 12], 'seedling', 'Needs a warm, sunny spot. Be patient: fruit sets in late summer.'],
    ['Zucchini', [10, 11, 12, 1], 'sow_direct', 'One or two plants is plenty for a family.'],
    ['Rockmelon', [10, 11, 12], 'seed_tray', 'Give it room to sprawl and water at the base, not the leaves.'],
    ['Beans', [10, 11, 12, 1], 'sow_direct', 'Sow every few weeks for a steady supply.'],
    ['Lettuce', [2, 3, 4, 5, 8, 9, 10, 11], 'seed_tray', 'Give afternoon shade once the weather warms up.'],
    ['Silverbeet', [2, 3, 4, 5, 8, 9, 10, 11], 'seed_tray', 'Pick the outer leaves and it keeps growing for months.'],
    ['Coriander', [3, 4, 5, 9, 10], 'sow_direct', 'Runs to seed in hot weather, so sow little and often.'],
    ['Rocket', [2, 3, 4, 5, 8, 9, 10, 11], 'sow_direct', 'Ready to pick in about four weeks.'],
    ['Garlic', [3, 4, 5], 'sow_direct', 'Plant cloves pointy end up, about 5 cm deep.'],
    ['Broad beans', [3, 4, 5, 6], 'sow_direct', 'Add a frame or string so they do not flop over.'],
  ],
  cool: [
    ['Tomato', [10, 11, 12], 'seedling', 'Wait until frosts have passed before planting out.'],
    ['Potatoes', [9, 10, 11], 'sow_direct', 'Plant seed potatoes and mound soil up around the stems as they grow.'],
    ['Zucchini', [11, 12], 'sow_direct', 'Sow once the soil feels warm to touch.'],
    ['Beans', [11, 12], 'sow_direct', 'Beans rot in cold soil, so do not rush them.'],
    ['Lettuce', [9, 10, 11, 12, 1, 2, 3], 'seed_tray', 'Plant a few every fortnight for a steady supply.'],
    ['Silverbeet', [2, 3, 9, 10, 11, 12], 'seed_tray', 'Very hardy and handles cold well.'],
    ['Rocket', [9, 10, 11, 12, 1, 2, 3], 'sow_direct', 'Quick and easy. Pick young leaves for the mildest flavour.'],
    ['Coriander', [3, 9, 10, 11], 'sow_direct', 'Grows best in mild weather.'],
    ['Garlic', [3, 4, 5], 'sow_direct', 'Needs a cold winter to form good bulbs.'],
    ['Broad beans', [3, 4, 5], 'sow_direct', 'Pinch out the tips when the first pods form.'],
    ['Peas', [3, 4, 5, 8, 9], 'sow_direct', 'Give them something to climb.'],
  ],
  subtropical: [
    ['Tomato', [2, 3, 4, 7, 8, 9], 'seedling', 'Avoid the humid wet season, when diseases spread fast.'],
    ['Capsicum', [8, 9, 10, 11], 'seedling', 'Mulch well to keep the roots moist.'],
    ['Basil', [9, 10, 11, 12], 'seedling', 'Grows fast in the warmth. Pick often.'],
    ['Snake beans', [9, 10, 11, 12], 'sow_direct', 'Thrives in heat and humidity. Needs a tall trellis.'],
    ['Sweet potato', [9, 10, 11, 12], 'seedling', 'Plant cuttings (slips) and let them run.'],
    ['Rockmelon', [8, 9, 10, 11], 'seed_tray', 'Plant early so fruit ripens before the wet season.'],
    ['Cucumber', [8, 9, 10, 11, 12], 'sow_direct', 'Grow up a trellis to keep fruit clean.'],
    ['Zucchini', [2, 3, 8, 9, 10, 11], 'sow_direct', 'Watch for powdery mildew in humid weather.'],
    ['Lettuce', [3, 4, 5, 6, 7, 8, 9], 'seed_tray', 'Grows best in the cooler, drier months.'],
    ['Silverbeet', [3, 4, 5, 6, 7, 8, 9], 'seed_tray', 'An easy winter crop.'],
    ['Coriander', [4, 5, 6, 7], 'sow_direct', 'Only grows well in the cooler months here.'],
    ['Rocket', [3, 4, 5, 6, 7, 8, 9], 'sow_direct', 'Grows quickly in mild weather.'],
  ],
  tropical: [
    ['Sweet potato', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'seedling', 'Grows all year. Plant cuttings (slips).'],
    ['Basil', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'seedling', 'Thai basil handles the wet season best.'],
    ['Snake beans', [9, 10, 11, 12, 1], 'sow_direct', 'Loves the build-up and wet season heat.'],
    ['Okra', [9, 10, 11, 12], 'sow_direct', 'Pick pods small, about 8 cm, before they get tough.'],
    ['Kang kong', [10, 11, 12, 1, 2, 3], 'seedling', 'Loves water. Keep the soil very moist.'],
    ['Rosella', [10, 11, 12, 1], 'seed_tray', 'Harvest the red calyces for jam and tea.'],
    ['Tomato', [4, 5, 6, 7], 'seedling', 'Plant in the dry season only.'],
    ['Capsicum', [3, 4, 5, 6, 7], 'seedling', 'Best planted as the dry season starts.'],
    ['Lettuce', [4, 5, 6, 7], 'seed_tray', 'Only grows well in the dry season. Give it some shade.'],
    ['Rockmelon', [4, 5, 6], 'seed_tray', 'Plant early in the dry season.'],
    ['Coriander', [5, 6, 7], 'sow_direct', 'Try it in the coolest, driest months.'],
  ],
  arid: [
    ['Tomato', [2, 3, 8, 9, 10], 'seedling', 'Use shade cloth on days over 35°C.'],
    ['Capsicum', [9, 10], 'seedling', 'Plant early so it settles in before the heat.'],
    ['Zucchini', [2, 9, 10], 'sow_direct', 'Water deeply at the base early in the morning.'],
    ['Rockmelon', [9, 10, 11], 'seed_tray', 'Loves dry heat. Mulch to keep fruit off the soil.'],
    ['Pumpkin', [9, 10, 11], 'sow_direct', 'Needs plenty of room and deep watering.'],
    ['Okra', [10, 11, 12], 'sow_direct', 'Handles heat well once established.'],
    ['Sweet potato', [10, 11, 12], 'seedling', 'Thrives in warm soil.'],
    ['Lettuce', [3, 4, 5, 6, 7, 8], 'seed_tray', 'A cool-season crop here. Give afternoon shade.'],
    ['Silverbeet', [3, 4, 5, 6, 7, 8, 9], 'seed_tray', 'Tough and reliable in the cooler months.'],
    ['Coriander', [4, 5, 6, 7, 8], 'sow_direct', 'Grows best in winter here.'],
    ['Broad beans', [4, 5, 6], 'sow_direct', 'Sow in autumn for a spring harvest.'],
    ['Garlic', [3, 4, 5], 'sow_direct', 'Plant cloves in autumn and harvest in late spring.'],
  ],
};

export const PLANTING_CALENDAR: PlantingCalendarRow[] = Object.entries(CROPS).flatMap(
  ([zone, crops]) =>
    crops.map(([crop_name, months, method, tip]) => ({
      id: `${zone}-${crop_name.toLowerCase().replace(/\s+/g, '-')}`,
      country: 'AU',
      zone: zone as ClimateZone,
      crop_name,
      months,
      method,
      tip,
    })),
);

// ---------- Monthly jobs ----------

type Season = 'summer' | 'autumn' | 'winter' | 'spring' | 'wet' | 'dry';

function seasonFor(zone: ClimateZone, month: number): Season {
  if (zone === 'tropical') return month >= 5 && month <= 10 ? 'dry' : 'wet';
  if (month === 12 || month <= 2) return 'summer';
  if (month <= 5) return 'autumn';
  if (month <= 8) return 'winter';
  return 'spring';
}

const JOBS: Record<ClimateZone, Partial<Record<Season, string[]>>> = {
  temperate: {
    spring: [
      'Mulch garden beds 5–7 cm deep before the weather warms up. Keep it off plant stems.',
      'Feed citrus and fruit trees with a slow-release fertiliser.',
      'Check new growth for aphids and hose them off.',
      'Plant summer veggie seedlings now that frosts are over.',
    ],
    summer: [
      'Water deeply in the early morning, 2–3 times a week, rather than a little every day.',
      'Pick zucchini and beans often to keep them cropping.',
      'Put shade cloth over seedlings on days over 35°C.',
      'Top up mulch to keep roots cool.',
    ],
    autumn: [
      'Plant garlic cloves and sow broad beans.',
      'Rake fallen leaves into the compost.',
      'Plant spring-flowering bulbs.',
      'Pull out finished summer crops.',
    ],
    winter: [
      'Prune roses and deciduous fruit trees.',
      'Plant bare-root fruit trees.',
      'Check drainage after heavy rain.',
      'Plan and order seeds for spring.',
    ],
  },
  cool: {
    spring: [
      'Watch for late frosts and cover tender seedlings overnight.',
      'Start tomatoes and capsicum in a seed tray indoors.',
      'Mulch beds once the soil has warmed.',
      'Feed fruit trees as new growth appears.',
    ],
    summer: [
      'Water deeply in the morning during dry spells.',
      'Pick berries and early veggies often.',
      'Top up mulch to hold in moisture.',
    ],
    autumn: [
      'Plant garlic and sow broad beans and peas.',
      'Protect tender plants before the first frosts.',
      'Add compost to empty beds.',
    ],
    winter: [
      'Prune roses and deciduous fruit trees.',
      'Keep off frosted lawns until they thaw.',
      'Plant bare-root trees and berries.',
    ],
  },
  subtropical: {
    spring: [
      'Plant heat-loving crops like snake beans and sweet potato.',
      'Fertilise garden beds as growth picks up.',
      'Set fruit fly traps before fruit starts to ripen.',
    ],
    summer: [
      'Watch for fungal problems after rain. Remove affected leaves and give plants space for air flow.',
      'Mulch to keep roots cool and stop soil washing away.',
      'Pick up fallen fruit to help control fruit fly.',
    ],
    autumn: [
      'This is prime planting time for tomatoes, lettuce and herbs.',
      'Add compost to beds after the summer rain.',
      'Trim back plants that got leggy over summer.',
    ],
    winter: [
      'Water seedlings regularly. Winter is the dry season here.',
      'Plant brassicas like broccoli and cabbage.',
      'Keep picking leafy greens.',
    ],
  },
  tropical: {
    wet: [
      'Clear drains and gutters before storms.',
      'Grow heat-loving greens like kang kong and Ceylon spinach.',
      'Remove leaves with fungal spots to slow the spread.',
      'Mulch to stop heavy rain washing soil away.',
    ],
    dry: [
      'Plant tomatoes, lettuce and herbs while it is cooler and drier.',
      'Water deeply and mulch well.',
      'Prune back shrubs that grew fast over the wet season.',
    ],
  },
  arid: {
    spring: [
      'Plant early so crops settle in before the heat.',
      'Set up drip irrigation or wicking beds to save water.',
      'Mulch thickly, 7–10 cm deep.',
    ],
    summer: [
      'Water at dawn and use shade cloth over veggies.',
      'Hold off planting during extreme heat.',
      'Check irrigation for leaks and blocked drippers.',
    ],
    autumn: [
      'Second planting season: sow lettuce, silverbeet and broad beans.',
      'Dig compost into beds.',
      'Plant garlic.',
    ],
    winter: [
      'Protect seedlings from frost on cold desert nights.',
      'Plant onions.',
      'Water less often while it is cool.',
    ],
  },
};

export const MONTHLY_JOBS: MonthlyJobRow[] = (Object.keys(JOBS) as ClimateZone[]).flatMap(
  (zone) =>
    Array.from({ length: 12 }, (_, i) => i + 1).flatMap((month) =>
      (JOBS[zone][seasonFor(zone, month)] ?? []).map((job, j) => ({
        id: `${zone}-${month}-${j}`,
        country: 'AU',
        zone,
        month,
        job,
      })),
    ),
);

// ---------- Declared weeds (EXAMPLES ONLY) ----------

const EXAMPLE_NOTE = 'Example data for testing only. ';

const WEED_URLS: Record<string, string> = {
  NSW: 'https://weeds.dpi.nsw.gov.au/',
  QLD: 'https://www.business.qld.gov.au/industries/farms-fishing-forestry/agriculture/biosecurity/plants/invasive',
  NT: 'https://nt.gov.au/environment/weeds',
  WA: 'https://www.agric.wa.gov.au/pests-weeds-diseases/weeds',
  VIC: 'https://agriculture.vic.gov.au/biosecurity/weeds',
  TAS: 'https://nre.tas.gov.au/invasive-species/weeds',
  SA: 'https://pir.sa.gov.au/biosecurity/weeds',
  ACT: 'https://www.cityservices.act.gov.au/pets-and-wildlife/pest-animals-and-weeds/weeds',
};

export const DECLARED_WEEDS: DeclaredWeedRow[] = [
  ...(['NSW', 'QLD', 'NT', 'WA'] as const).map((state) => ({
    id: `lantana-${state}`,
    country: 'AU',
    state,
    scientific_name: 'Lantana camara',
    common_name: 'Lantana',
    status_note: `${EXAMPLE_NOTE}Declared weed. Do not sell, buy or plant it, and control it on your land.`,
    official_url: WEED_URLS[state],
  })),
  ...(['VIC', 'TAS', 'SA'] as const).map((state) => ({
    id: `gorse-${state}`,
    country: 'AU',
    state,
    scientific_name: 'Ulex europaeus',
    common_name: 'Gorse',
    status_note: `${EXAMPLE_NOTE}Declared weed. Landowners must control it and stop it spreading.`,
    official_url: WEED_URLS[state],
  })),
  {
    id: 'blackberry-ACT',
    country: 'AU',
    state: 'ACT',
    scientific_name: 'Rubus fruticosus',
    common_name: 'Blackberry',
    status_note: `${EXAMPLE_NOTE}Declared pest plant. Control it on your land and do not spread it.`,
    official_url: WEED_URLS.ACT,
  },
];

// ---------- Phosphorus-sensitive natives ----------

export const PHOSPHORUS_SENSITIVE_GENERA: PhosphorusGenusRow[] = [
  { id: 'grevillea', genus: 'Grevillea', note: 'Most grevilleas are harmed by high-phosphorus fertilisers.' },
  { id: 'banksia', genus: 'Banksia', note: 'Banksias have special roots that take up too much phosphorus.' },
  { id: 'hakea', genus: 'Hakea', note: 'Like other members of the protea family, hakeas dislike phosphorus.' },
  { id: 'persoonia', genus: 'Persoonia', note: 'Geebungs are very sensitive to phosphorus.' },
  { id: 'telopea', genus: 'Telopea', note: 'Waratahs prefer low-phosphorus soil.' },
];

// ---------- Australian name swaps ----------

export const NAME_SWAPS: NameSwapRow[] = [
  { id: '1', country: 'AU', from_name: 'Bell pepper', to_name: 'Capsicum' },
  { id: '2', country: 'AU', from_name: 'Sweet pepper', to_name: 'Capsicum' },
  { id: '3', country: 'AU', from_name: 'Swiss chard', to_name: 'Silverbeet' },
  { id: '4', country: 'AU', from_name: 'Cantaloupe', to_name: 'Rockmelon' },
  { id: '5', country: 'AU', from_name: 'Cilantro', to_name: 'Coriander' },
  { id: '6', country: 'AU', from_name: 'Arugula', to_name: 'Rocket' },
  { id: '7', country: 'AU', from_name: 'Scallion', to_name: 'Spring onion' },
];

// ---------- Sample scan results (pretend plant-ID answers) ----------

/** The weed sample changes with the user's state so the red banner shows. */
export function sampleWeedIdentification(scientificName: string, commonName: string): RawIdentification {
  return {
    commonName,
    scientificName,
    confidence: 0.91,
    description: `${commonName} is a fast-spreading shrub that has escaped from gardens into bushland in many parts of Australia.`,
    light: 'Full sun to part shade',
    water: 'Low. Very drought hardy',
    isHealthy: true,
    healthyProbability: 0.94,
    problems: [],
  };
}

export const SAMPLE_IDENTIFICATIONS: RawIdentification[] = [
  {
    commonName: 'Rosemary grevillea',
    scientificName: 'Grevillea rosmarinifolia',
    confidence: 0.88,
    description:
      'A tough Australian native shrub with needle-like leaves and red spider flowers that birds love.',
    light: 'Full sun',
    water: 'Low once established. Water weekly for the first summer',
    isHealthy: true,
    healthyProbability: 0.92,
    problems: [],
  },
  {
    commonName: 'Bell pepper',
    scientificName: 'Capsicum annuum',
    confidence: 0.84,
    description: 'A warm-season vegetable that needs a long, sunny summer to ripen its fruit.',
    light: 'Full sun, at least 6 hours a day',
    water: 'Moderate. Keep the soil evenly moist',
    isHealthy: false,
    healthyProbability: 0.22,
    problems: [
      {
        name: 'Aphids',
        probability: 0.68,
        description: 'Small sap-sucking insects that cluster on new growth and under leaves.',
        steps: [
          'Blast them off with a strong spray of water from the hose.',
          'Squash small groups between your fingers.',
          'Encourage ladybirds and lacewings, which eat aphids. Avoid broad-spectrum sprays that kill them too.',
          'If they keep coming back, use an insecticidal soap and follow the label.',
        ],
      },
      {
        name: 'Water stress',
        probability: 0.34,
        description: 'Wilting or curling leaves can mean the plant is too dry, or sitting in soggy soil.',
        steps: [
          'Check the soil with your finger. Water deeply if the top 3 cm is dry.',
          'Add mulch to keep moisture in.',
          'Make sure the pot or bed drains well.',
        ],
      },
    ],
  },
  {
    commonName: 'Spearmint',
    scientificName: 'Mentha spicata',
    confidence: 0.34,
    description: 'A hardy herb that spreads quickly by underground runners. Best grown in a pot.',
    light: 'Part shade to full sun',
    water: 'High. Keep moist',
    isHealthy: true,
    healthyProbability: 0.81,
    problems: [],
  },
];

// ---------- Sample garden ----------

export const SAMPLE_GARDEN: GardenPlant[] = [
  {
    id: 'sample-lemon',
    commonName: 'Lemon',
    scientificName: 'Citrus limon',
    notes: 'Planted by the back fence. Feed in spring and autumn.',
    createdAt: '2026-09-14T09:00:00.000Z',
    photos: [],
    reminder: { enabled: false, everyDays: 4 },
  },
  {
    id: 'sample-kangaroo-paw',
    commonName: 'Kangaroo paw',
    scientificName: 'Anigozanthos flavidus',
    notes: 'Cut old flower stems right down after flowering.',
    createdAt: '2026-10-02T09:00:00.000Z',
    photos: [],
    reminder: { enabled: false, everyDays: 7 },
  },
];
