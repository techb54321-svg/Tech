// ---------------------------------------------------------------------------
// Domain model for the Rosie Bear Separation Coach engine.
//
// Everything here is data. The engine (progression.ts / index.ts) is a pure
// function of this data. No dates are read from the clock, no randomness is
// drawn from Math.random — both are passed in, so every result is reproducible
// and testable.
// ---------------------------------------------------------------------------

/** How a single graduated-absence rep went, in the owner's three taps. */
export type Outcome = 'settled' | 'stirred' | 'distressed';

/**
 * The departure cue that unsettles the dog first. Used to seed the cue-
 * decoupling track. Kept as a small closed set so copy can be templated; the
 * intake can still capture a free-text description alongside it.
 */
export type DepartureCue =
  | 'keys'
  | 'shoes'
  | 'coat'
  | 'bag'
  | 'door'
  | 'alarm'
  | 'other';

/**
 * Red-flag screen answered at intake. ANY true value means we do not enrol the
 * dog and route to a vet / veterinary behaviourist instead. These are signs of
 * clinical separation anxiety, which is out of scope for a training program.
 */
export interface TriageFlags {
  /** Chewing/licking to the point of self-injury when alone. */
  selfInjury: boolean;
  /** Destruction focused at exit points (doors, window frames, crate bars). */
  exitPointDestruction: boolean;
  /** Won't eat a normally-loved food when left alone. */
  refusesFoodWhenAlone: boolean;
  /** Toileting indoors when alone despite being reliably house-trained. */
  eliminationDespiteHousetrained: boolean;
}

/** Captured once, at intake. The stable facts the engine paces against. */
export interface Profile {
  /**
   * Owner's honest estimate of how long the dog is calm before distress
   * begins, in seconds. Treated as a self-reported ESTIMATE only: it sets the
   * conservative starting rung, never a proven ceiling. All progression is
   * anchored to durations the dog has actually held (see `frontier`).
   */
  baselineCalmSeconds: number;
  /** Which departure cue triggers first — seeds the decoupling track. */
  firstDepartureCue: DepartureCue;
  /** Whether the owner can watch a camera while out (informational in v1). */
  hasCamera: boolean;
  /** Free-text home context (apartment/house, crate/free-roam, etc.). */
  homeSetup: string;
  /**
   * Realistic sessions the owner can commit to per WEEK. This is the number
   * most plans get wrong. Low availability makes progression more conservative,
   * never faster.
   */
  weeklyAvailability: number;
  /** Whether the Rosie Bear chew is part of this dog's program. */
  useChew: boolean;
  /** Intake red-flag screen. */
  triageFlags: TriageFlags;
}

/** One logged graduated-absence rep. Written locally, offline-tolerant. */
export interface SessionLog {
  /** ISO date (YYYY-MM-DD) the rep was done. */
  date: string;
  /** The target duration that was PRESCRIBED for this rep, in seconds. */
  targetSeconds: number;
  /** How it went. */
  outcome: Outcome;
  /**
   * Seconds it took the dog to settle after the owner left. For a `distressed`
   * rep this is the time until the owner returned. Used as a light "err short"
   * signal: a settled-but-slow rep is treated as a hold, not a climb.
   */
  timeToSettleSeconds: number;
  /** Optional free-text note (later parsed by the LLM into structured signals). */
  note?: string;
  /** Result of the cue-decoupling rep, if one was done this session. */
  cueResult?: Outcome;
  /** Whether a Rosie Bear chew was given for this rep. */
  chewUsed: boolean;
}

/** Why the program stopped or won't start — always routes to a professional. */
export interface Referral {
  kind: 'refer';
  /** Machine reason (for logs/debugging). User-facing copy is written elsewhere. */
  reason:
    | 'triage-selfInjury'
    | 'triage-exitPointDestruction'
    | 'triage-refusesFoodWhenAlone'
    | 'triage-eliminationDespiteHousetrained'
    | 'escalation-consecutive-distress';
  /** Short, non-alarming explanation the UI can surface as-is or via the LLM. */
  message: string;
}

/** What the engine tells the owner to do today. One card, deterministic. */
export interface DailyPlan {
  /** ISO date this plan is for. */
  date: string;
  /**
   * active  — run today's rep.
   * refer   — intake triage said do not enrol.
   * halted  — mid-program welfare stop; progression is paused pending referral.
   */
  status: 'active' | 'refer' | 'halted';

  // --- Duration track (only meaningful when status === 'active') ---
  /** Today's absence target in seconds. Never chosen by a model. */
  targetSeconds: number;
  /** The highest duration the dog has actually held calm so far, in seconds. */
  frontierSeconds: number;

  // --- Cue-decoupling track (runs in parallel, own progress) ---
  cueToWork: DepartureCue;
  cueStep: number;
  cueInstruction: string;
  cueMastered: boolean;

  // --- Re-entry + chew ---
  reentryInstruction: string;
  chewRecommended: boolean;
  chewNote: string;

  /** Present only when status !== 'active'. */
  referral: Referral | null;

  /**
   * Non-user-facing trace of how today's number was reached. Used by tests and
   * the simulation; the UI never shows this — the LLM writes the card copy.
   */
  rationale: PlanRationale;
}

/** Which branch of the rule engine produced today's target. */
export type ProgressionMove =
  | 'first' // no history yet — conservative starting rung
  | 'climb' // last rep settled — small randomised increment from the frontier
  | 'short-rep' // deliberate shorter rep so duration stays unpredictable
  | 'hold' // stirred, or settled-but-slow — repeat, don't push
  | 'drop' // distressed — fall below the frontier and rebuild
  | 're-warm'; // returning after a gap — gentle rep below the frontier

export interface PlanRationale {
  move: ProgressionMove;
  frontierSeconds: number;
  ceilingSeconds: number;
  daysSinceLastSession: number | null;
  consecutiveDistress: number;
}
