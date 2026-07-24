// ---------------------------------------------------------------------------
// Intake triage gate.
//
// Screens for signs of clinical separation anxiety. Any single hit means we do
// NOT enrol the dog — this is a training program, not a treatment, and pushing
// graduated absences on a dog in genuine distress can make things worse. We
// route to a vet or veterinary behaviourist with a warm, non-alarming message.
// ---------------------------------------------------------------------------

import type { Profile, Referral } from './types.js';

export interface TriageResult {
  enrol: boolean;
  referral: Referral | null;
}

/**
 * Ordered so the message names the most acute sign first if several are set.
 * Copy here is a grounded default; the LLM may rewrite it in brand voice, but
 * it must never soften the referral into a "carry on anyway".
 */
const REFER_MESSAGE =
  "Before we start, a couple of your answers point to something a training " +
  "program isn't the right tool for — and that's not a failing on your part or " +
  "your dog's. Signs like these are worth showing to a vet or a veterinary " +
  "behaviourist, who can help in ways a treat and a schedule can't. Please " +
  "start there. We'll be here if the time is ever right.";

export function assessTriage(profile: Profile): TriageResult {
  const f = profile.triageFlags;

  const reason: Referral['reason'] | null = f.selfInjury
    ? 'triage-selfInjury'
    : f.exitPointDestruction
      ? 'triage-exitPointDestruction'
      : f.refusesFoodWhenAlone
        ? 'triage-refusesFoodWhenAlone'
        : f.eliminationDespiteHousetrained
          ? 'triage-eliminationDespiteHousetrained'
          : null;

  if (reason === null) {
    return { enrol: true, referral: null };
  }

  return {
    enrol: false,
    referral: { kind: 'refer', reason, message: REFER_MESSAGE },
  };
}
