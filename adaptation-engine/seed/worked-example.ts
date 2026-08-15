/**
 * The hand-authored worked example.
 *
 * Written by hand, not produced by a model: it exists so the app is
 * demonstrable from first run without an API key. Every stage row it creates
 * records model "hand-authored-seed", and the governance record prints that
 * value wherever a real run would print a model ID. See seed/README.md.
 *
 * The two versions are the demonstration:
 *   v1  three real fidelity flags, so the document is BLOCKED
 *   v2  the same source re-run with those corrected, ready for review
 */

export const SEED_MODEL = "hand-authored-seed";

export const ADAPTED_V2 = `# Understanding Your Heart Risk

Northern Metropolitan Health Service

## What is heart risk?

Cardiovascular disease is a disease of the heart and blood vessels. You may see
the word "cardiovascular" on your test results.

Your heart risk is your chance of having a heart attack or a stroke in the next
5 years.

Your doctor works out your risk from six things: your age, your sex, your blood
pressure, your cholesterol, whether you smoke, and whether you have diabetes.

A heart risk of 15% or higher is called high risk. Your doctor uses this number,
so it is written here the same way your doctor writes it.

Here is what 15% means. If 100 people with your risk stood in a room, about 15
of them would have a heart attack or a stroke in the next 5 years. About 85 of
them would not.

If 100 Australian adults stood in a room, about 25 of them would have a moderate
or high heart risk.

## What raises your risk?

Some things that raise your risk cannot be changed. These are your age, your
sex, and your family history.

Many other things can be changed. This is where you can act.

Smoking doubles your chance of a heart attack. If you stop smoking, your chance
drops by half within one year.

Not moving your body, carrying extra weight, and eating poorly also raise your
risk.

## What you can do

Everyone at home eats the same meals. These changes work best when your family
makes them with you.

- Check your blood pressure. Write down the number. Your blood pressure should
  stay under 140/90 mmHg.
- Choose wholegrain bread. Have a bowl of porridge for breakfast.
- Move your body more often than you do now.
- If you drink alcohol, drink less.
- At festivals and family celebrations there is more food than usual. These are
  the times it is easiest to eat much more than you planned.

Go to your doctor once a year for a heart check.

## Your medicines

If your doctor has given you a statin, take one 20 mg tablet every evening.

Do not stop taking this medicine. Speak to your doctor first, even if you feel
well.

If you get muscle pain you cannot explain, stop taking this medicine and phone
your doctor.

Statins lower the chance of a heart attack or a stroke.

## When to call an ambulance

Call an ambulance straight away if you have any of these:

- chest pain that lasts more than 10 minutes
- pain spreading to your arm or jaw
- trouble breathing
- feeling sick or sweating
`;

/**
 * Version 1, with three defects the fidelity stage is meant to catch:
 *   - the ambulance instruction loses "straight away"      WEAKENED, NS-01
 *   - the do-not-stop instruction loses its condition      CONDITION_DROPPED, NS-04
 *   - a reassurance appears that the source never made     INVENTED
 */
export const ADAPTED_V1 = ADAPTED_V2.replace(
  "Do not stop taking this medicine. Speak to your doctor first, even if you feel\nwell.",
  "Do not stop taking this medicine. Speak to your doctor first.",
)
  .replace(
    "Statins lower the chance of a heart attack or a stroke.",
    "Statins lower the chance of a heart attack or a stroke. Most people take them\nwithout any problems.",
  )
  .replace("Call an ambulance straight away if you have any of these:", "Call an ambulance if you have any of these:");

export interface SeedAssertion {
  stableId: string;
  category: string;
  text: string;
  verbatimQuote: string;
  strength: string;
  numbers: { value: string; unit: string; direction: string }[];
  conditions: string[];
  isProtected: boolean;
  protectedRuleIds: string[];
}

export const SOURCE_ASSERTIONS: SeedAssertion[] = [
  {
    stableId: "CA-001",
    category: "RISK_STATEMENT",
    text: "Absolute cardiovascular risk is the probability of a cardiovascular event, such as a heart attack or stroke, within the next five years.",
    verbatimQuote:
      "Your absolute cardiovascular risk is the probability of experiencing a cardiovascular event, such as a heart attack or stroke, within the next five years.",
    strength: "STATEMENT",
    numbers: [{ value: "five", unit: "years", direction: "within" }],
    conditions: [],
    isProtected: true,
    protectedRuleIds: ["NS-06"],
  },
  {
    stableId: "CA-002",
    category: "RISK_STATEMENT",
    text: "Absolute cardiovascular risk is calculated from age, sex, blood pressure, cholesterol, smoking status and diabetes status.",
    verbatimQuote:
      "It is calculated using a combination of factors including your age, sex, blood pressure, cholesterol levels, smoking status and whether you have diabetes.",
    strength: "STATEMENT",
    numbers: [],
    conditions: [],
    isProtected: false,
    protectedRuleIds: [],
  },
  {
    stableId: "CA-003",
    category: "THRESHOLD",
    text: "A calculated cardiovascular risk of 15% or higher is classified as high risk.",
    verbatimQuote: "If your calculated risk is 15% or higher, you are considered to be at high risk.",
    strength: "STATEMENT",
    numbers: [{ value: "15", unit: "%", direction: "or higher" }],
    conditions: [],
    isProtected: true,
    protectedRuleIds: ["NS-06"],
  },
  {
    stableId: "CA-004",
    category: "RISK_STATEMENT",
    text: "Approximately 1 in 4 Australian adults is in the moderate or high risk category.",
    verbatimQuote:
      "Approximately 1 in 4 Australian adults falls into the moderate or high risk category.",
    strength: "STATEMENT",
    numbers: [{ value: "1 in 4", unit: "adults", direction: "approximately" }],
    conditions: [],
    isProtected: true,
    protectedRuleIds: ["NS-06"],
  },
  {
    stableId: "CA-005",
    category: "RISK_STATEMENT",
    text: "Age, sex and family history are risk factors that cannot be modified.",
    verbatimQuote:
      "some risk factors cannot be modified, such as your age, your sex and your family history",
    strength: "STATEMENT",
    numbers: [],
    conditions: [],
    isProtected: false,
    protectedRuleIds: [],
  },
  {
    stableId: "CA-006",
    category: "RISK_STATEMENT",
    text: "Smoking doubles the risk of a heart attack.",
    verbatimQuote: "Smoking doubles your risk of a heart attack.",
    strength: "STATEMENT",
    numbers: [{ value: "double", unit: "", direction: "exactly" }],
    conditions: [],
    isProtected: true,
    protectedRuleIds: ["NS-06"],
  },
  {
    stableId: "CA-007",
    category: "RISK_STATEMENT",
    text: "Quitting smoking halves the risk within one year.",
    verbatimQuote: "Quitting smoking halves your risk within one year.",
    strength: "STATEMENT",
    numbers: [
      { value: "half", unit: "", direction: "exactly" },
      { value: "one", unit: "year", direction: "within" },
    ],
    conditions: [],
    isProtected: true,
    protectedRuleIds: ["NS-06"],
  },
  {
    stableId: "CA-008",
    category: "RISK_STATEMENT",
    text: "Physical inactivity, excess weight and a poor diet contribute to cardiovascular risk.",
    verbatimQuote:
      "Being physically inactive, carrying excess weight and having a poor diet all contribute.",
    strength: "STATEMENT",
    numbers: [],
    conditions: [],
    isProtected: false,
    protectedRuleIds: [],
  },
  {
    stableId: "CA-009",
    category: "THRESHOLD",
    text: "Target blood pressure is less than 140/90 mmHg.",
    verbatimQuote: "Your target should be less than 140/90 mmHg.",
    strength: "SHOULD",
    numbers: [{ value: "140/90", unit: "mmHg", direction: "less than" }],
    conditions: [],
    isProtected: true,
    protectedRuleIds: ["NS-06"],
  },
  {
    stableId: "CA-010",
    category: "ACTION",
    text: "Attend an annual review with a general practitioner.",
    verbatimQuote:
      "Patients are advised to attend an annual review with their general practitioner.",
    strength: "SHOULD",
    numbers: [{ value: "1", unit: "year", direction: "every" }],
    conditions: [],
    isProtected: true,
    protectedRuleIds: ["NS-06"],
  },
  {
    stableId: "CA-011",
    category: "DOSE",
    text: "If a statin has been prescribed, take one 20 mg tablet each evening.",
    verbatimQuote:
      "If you have been prescribed a statin, take one 20 mg tablet each evening.",
    strength: "MUST",
    numbers: [
      { value: "1", unit: "tablet", direction: "exactly" },
      { value: "20", unit: "mg", direction: "exactly" },
    ],
    conditions: ["you have been prescribed a statin"],
    isProtected: true,
    protectedRuleIds: ["NS-02", "NS-06"],
  },
  {
    stableId: "CA-012",
    category: "ACTION",
    text: "Do not stop taking this medicine without speaking to your doctor, even if you feel well.",
    verbatimQuote:
      "Do not stop taking this medicine without speaking to your doctor, even if you feel well.",
    strength: "MUST",
    numbers: [],
    conditions: ["even if you feel well"],
    isProtected: true,
    protectedRuleIds: ["NS-04", "NS-08"],
  },
  {
    stableId: "CA-013",
    category: "CONTRAINDICATION",
    text: "If unexplained muscle pain develops, stop taking this medicine and contact your doctor.",
    verbatimQuote:
      "Stop taking this medicine and contact your doctor if you develop unexplained muscle pain.",
    strength: "MUST",
    numbers: [],
    conditions: ["you develop unexplained muscle pain"],
    isProtected: true,
    protectedRuleIds: ["NS-03", "NS-08"],
  },
  {
    stableId: "CA-014",
    category: "OTHER",
    text: "Statins are effective at reducing cardiovascular events.",
    verbatimQuote: "Research shows that statins are effective at reducing cardiovascular events.",
    strength: "STATEMENT",
    numbers: [],
    conditions: [],
    isProtected: false,
    protectedRuleIds: [],
  },
  {
    stableId: "CA-015",
    category: "WARNING_SIGN",
    text: "Call an ambulance immediately for chest pain lasting more than 10 minutes, pain spreading to the arm or jaw, shortness of breath, or nausea and sweating.",
    verbatimQuote:
      "Call an ambulance immediately if you experience chest pain lasting more than 10 minutes, pain spreading to your arm or jaw, shortness of breath, or nausea and sweating.",
    strength: "MUST",
    numbers: [{ value: "10", unit: "minutes", direction: "more than" }],
    conditions: [
      "chest pain lasting more than 10 minutes",
      "pain spreading to your arm or jaw",
      "shortness of breath",
      "nausea and sweating",
    ],
    isProtected: true,
    protectedRuleIds: ["NS-01", "NS-06"],
  },
];

export interface SeedChange {
  ordinal: number;
  ruleId: string;
  ruleDimension: string;
  ruleStatus: string;
  beforeText: string;
  afterText: string;
  rationalePlain: string;
  flagType?: string;
  touchesAssertionIds?: string[];
}

export const CHANGES: SeedChange[] = [
  {
    ordinal: 1,
    ruleId: "RL-07",
    ruleDimension: "reading-level",
    ruleStatus: "strawman",
    beforeText: "Cardiovascular disease (CVD) affects the heart and blood vessels.",
    afterText:
      'Cardiovascular disease is a disease of the heart and blood vessels. You may see the word "cardiovascular" on your test results.',
    rationalePlain:
      'The reader will meet "cardiovascular" again on their own test results and referral letters, so the word is kept and defined rather than replaced. The abbreviation CVD is dropped because it appears nowhere else in the document.',
    touchesAssertionIds: [],
  },
  {
    ordinal: 2,
    ruleId: "RL-03",
    ruleDimension: "reading-level",
    ruleStatus: "strawman",
    beforeText:
      "Your absolute cardiovascular risk is the probability of experiencing a cardiovascular event, such as a heart attack or stroke, within the next five years. It is calculated using a combination of factors including your age, sex, blood pressure, cholesterol levels, smoking status and whether you have diabetes.",
    afterText:
      "Your heart risk is your chance of having a heart attack or a stroke in the next 5 years.\n\nYour doctor works out your risk from six things: your age, your sex, your blood pressure, your cholesterol, whether you smoke, and whether you have diabetes.",
    rationalePlain:
      "Two ideas in a 42-word sentence became two sentences. The list of six factors is kept complete and counted, so a reader can check they heard all of them.",
    touchesAssertionIds: ["CA-001", "CA-002"],
  },
  {
    ordinal: 3,
    ruleId: "NUM-04",
    ruleDimension: "numeracy",
    ruleStatus: "assumed",
    beforeText: "If your calculated risk is 15% or higher, you are considered to be at high risk.",
    afterText:
      "A heart risk of 15% or higher is called high risk. Your doctor uses this number, so it is written here the same way your doctor writes it.",
    rationalePlain:
      "15% here is a clinical threshold, not a risk being communicated, so the number and its percentage sign are frozen. NUM-01 would normally forbid a percentage sign; NUM-04 wins, and the document says why the number looks the way it does.",
    touchesAssertionIds: ["CA-003"],
  },
  {
    ordinal: 4,
    ruleId: "NUM-01",
    ruleDimension: "numeracy",
    ruleStatus: "confirmed",
    beforeText: "(no equivalent in the source)",
    afterText:
      "Here is what 15% means. If 100 people with your risk stood in a room, about 15 of them would have a heart attack or a stroke in the next 5 years. About 85 of them would not.",
    rationalePlain:
      "The frozen threshold is explained as a room of 100 people, which is the picturable form of the same number. Both the event count and the no-event count are given, because a risk stated alone reads larger than it is.",
    touchesAssertionIds: ["CA-003"],
  },
  {
    ordinal: 5,
    ruleId: "NUM-01",
    ruleDimension: "numeracy",
    ruleStatus: "confirmed",
    beforeText:
      "Approximately 1 in 4 Australian adults falls into the moderate or high risk category.",
    afterText:
      "If 100 Australian adults stood in a room, about 25 of them would have a moderate or high heart risk.",
    rationalePlain:
      '"1 in 4" uses a different denominator from the 15% figure two sentences earlier, so the two cannot be compared by eye. Both are now out of 100.',
    touchesAssertionIds: ["CA-004"],
  },
  {
    ordinal: 6,
    ruleId: "AGY-01",
    ruleDimension: "agency",
    ruleStatus: "strawman",
    beforeText:
      "Unfortunately, some risk factors cannot be modified, such as your age, your sex and your family history. It is only a matter of time before these begin to affect you.",
    afterText:
      "Some things that raise your risk cannot be changed. These are your age, your sex, and your family history.\n\nMany other things can be changed. This is where you can act.",
    rationalePlain:
      '"Unfortunately" and "only a matter of time" tell the reader the outcome is already decided. The clinical content — that these factors are non-modifiable — is unchanged.',
    touchesAssertionIds: ["CA-005"],
  },
  {
    ordinal: 7,
    ruleId: "NUM-03",
    ruleDimension: "numeracy",
    ruleStatus: "confirmed",
    beforeText: "Smoking doubles your risk of a heart attack.",
    afterText: "Smoking doubles your chance of a heart attack.",
    rationalePlain:
      "This is a relative risk and the document contains no baseline to convert it from. It is carried through unchanged rather than converted, because converting would mean supplying a number the source never gave.",
    flagType: "RELATIVE_RISK_CARRIED",
    touchesAssertionIds: ["CA-006"],
  },
  {
    ordinal: 8,
    ruleId: "NUM-03",
    ruleDimension: "numeracy",
    ruleStatus: "confirmed",
    beforeText: "Quitting smoking halves your risk within one year.",
    afterText: "If you stop smoking, your chance drops by half within one year.",
    rationalePlain:
      "Carried through unchanged for the same reason. Note that this paragraph and the room-of-100 paragraph above now use two different risk formats — that is the known cost recorded against NUM-03.",
    flagType: "RELATIVE_RISK_CARRIED",
    touchesAssertionIds: ["CA-007"],
  },
  {
    ordinal: 9,
    ruleId: "ADR-01",
    ruleDimension: "addressee",
    ruleStatus: "confirmed",
    beforeText: "(no equivalent in the source)",
    afterText:
      "Everyone at home eats the same meals. These changes work best when your family makes them with you.",
    rationalePlain:
      "The profile's addressee mode is FAMILY_INCLUSIVE. The reader stays the subject of every instruction below; this sentence only names who else is affected.",
    touchesAssertionIds: [],
  },
  {
    ordinal: 10,
    ruleId: "IDM-01",
    ruleDimension: "idiom",
    ruleStatus: "strawman",
    beforeText: "Keep an eye on your blood pressure.",
    afterText: "Check your blood pressure. Write down the number.",
    rationalePlain:
      '"Keep an eye on" reads literally as watching, and gives no action. The replacement names the action and what to do with the result.',
    touchesAssertionIds: ["CA-009"],
  },
  {
    ordinal: 11,
    ruleId: "FOOD-02",
    ruleDimension: "food",
    ruleStatus: "confirmed",
    beforeText: "Choose wholegrain bread and have a bowl of porridge for breakfast.",
    afterText: "Choose wholegrain bread. Have a bowl of porridge for breakfast.",
    rationalePlain:
      "Both examples assume a cold cereal breakfast and a bread-based diet. No community is set on this profile and the substitution list is not signed off, so nothing was substituted. This is the flag you use to build the list.",
    flagType: "FOOD_SUBSTITUTION_NEEDED",
    touchesAssertionIds: [],
  },
  {
    ordinal: 12,
    ruleId: "AGY-03",
    ruleDimension: "agency",
    ruleStatus: "strawman",
    beforeText: "Aim to be more active.",
    afterText: "Move your body more often than you do now.",
    rationalePlain:
      'The source gives no target, so none was invented. "Aim to" was removed because it describes an intention rather than an action.',
    touchesAssertionIds: [],
  },
  {
    ordinal: 13,
    ruleId: "CAL-03",
    ruleDimension: "calendar",
    ruleStatus: "strawman",
    beforeText: "Cut down on alcohol.",
    afterText: "If you drink alcohol, drink less.",
    rationalePlain:
      'The original presumes the reader drinks. The conditional keeps the advice for readers who do and does not address readers who do not. "Cut down" is also idiomatic and gives no amount.',
    touchesAssertionIds: [],
  },
  {
    ordinal: 14,
    ruleId: "CAL-02",
    ruleDimension: "calendar",
    ruleStatus: "strawman",
    beforeText: "Take it easy over the Christmas period, when it is easy to overindulge.",
    afterText:
      "At festivals and family celebrations there is more food than usual. These are the times it is easiest to eat much more than you planned.",
    rationalePlain:
      'The clinical content is "a run of large celebratory meals", not Christmas. Naming the situation keeps the advice true whichever calendar the reader keeps. "Take it easy" was also ambiguous between resting and eating less.',
    touchesAssertionIds: [],
  },
  {
    ordinal: 15,
    ruleId: "ADR-04",
    ruleDimension: "addressee",
    ruleStatus: "strawman",
    beforeText: "Patients are advised to attend an annual review with their general practitioner.",
    afterText: "Go to your doctor once a year for a heart check.",
    rationalePlain:
      "Third-person passive turns an instruction into advice about someone else. The annual frequency is preserved exactly.",
    touchesAssertionIds: ["CA-010"],
  },
  {
    ordinal: 16,
    ruleId: "RL-05",
    ruleDimension: "reading-level",
    ruleStatus: "strawman",
    beforeText:
      "Stop taking this medicine and contact your doctor if you develop unexplained muscle pain.",
    afterText:
      "If you get muscle pain you cannot explain, stop taking this medicine and phone your doctor.",
    rationalePlain:
      "The condition now comes first, so a reader who stops mid-sentence does not read an unconditional instruction to stop their medicine. The sentence was not split, because splitting it would separate the instruction from its condition.",
    touchesAssertionIds: ["CA-013"],
  },
  {
    ordinal: 17,
    ruleId: "TRUST-02",
    ruleDimension: "trust",
    ruleStatus: "strawman",
    beforeText: "Research shows that statins are effective at reducing cardiovascular events.",
    afterText: "Statins lower the chance of a heart attack or a stroke.",
    rationalePlain:
      '"Research shows" names nobody the reader can check. The source names no body either, so none was added: the claim is stated plainly on the document\'s own authority.',
    touchesAssertionIds: ["CA-014"],
  },
  {
    ordinal: 18,
    ruleId: "RL-06",
    ruleDimension: "reading-level",
    ruleStatus: "strawman",
    beforeText:
      "Call an ambulance immediately if you experience chest pain lasting more than 10 minutes, pain spreading to your arm or jaw, shortness of breath, or nausea and sweating.",
    afterText:
      "Call an ambulance straight away if you have any of these:\n\n- chest pain that lasts more than 10 minutes\n- pain spreading to your arm or jaw\n- trouble breathing\n- feeling sick or sweating",
    rationalePlain:
      'Four symptoms in one 30-word sentence became a list, so none of them can be skimmed past. "Immediately" became "straight away" — the same urgency in plainer words — and every symptom and the 10-minute threshold are unchanged.',
    touchesAssertionIds: ["CA-015"],
  },
];
