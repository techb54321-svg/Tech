# Patch: project brief (source of truth)

> Read this whole file at the start of every session working on Patch.
> The "IMPORTANT CHANGES" section near the end overrides anything above it.

## How to work with me (the owner)

- I'm not a developer. Explain things in plain English and give me
  click-by-click steps whenever I need to do something myself (like creating
  an account or copying a key).
- Show a short plan and wait for my OK before writing code.
- Build in the phases below. After each phase, stop, tell me how to test it
  on my phone (Android), and wait for my OK.
- Commit to git after each phase.
- I test day to day on an **Android phone**: Expo Go first, then an
  installable Android test build. I do not have an iPhone and may not have a
  Mac. iPhone testing is done by friends via TestFlight.

## THE APP

"Patch" (working name): an AI garden helper for Australian home gardeners. It
names plants from a photo, checks their health, and tells people what to do
next where they live: what to plant and do this month in their climate zone,
whether a plant is a declared weed in their state, and how to care for
Australian natives.

## TECH

- Expo (latest SDK), React Native, TypeScript, Expo Router. Build for
  **Android and iPhone from the start** (see Important Changes).
- Supabase: Sign in with Apple (iPhone) and Sign in with Google (Android),
  database, private photo storage, Edge Functions.
- Plant.id API by Kindwise (docs: https://docs.kindwise.com) for
  identification and health checks (health=auto). Call it only from a Supabase
  Edge Function. Store the key as a Supabase secret named PLANT_ID_API_KEY.
  **Never put secret keys in the app or in git.**
- RevenueCat for subscriptions (App Store and Google Play).
- EAS Build and EAS Submit for App Store and Google Play builds.
- Resize photos to max 1500px before upload. Don't collect GPS location.

## STYLE

- Australian English and Australian plant names (capsicum, silverbeet,
  rockmelon, coriander, rocket). Say garden or backyard, not yard. Say autumn,
  not fall.
- Metric units. Australian dollars.
- Calm, friendly, plain language.
- Colours: eucalyptus green, warm sand, off-white. Large buttons. Support
  large text, VoiceOver/TalkBack and dark mode.
- Never hard-code Australia. Every location-based table has a country field
  (start with "AU") so countries can be added later just by adding data.

## SCREENS (tabs: Home, Scan, My Garden, Settings)

### 1. ONBOARDING (first launch)
- Welcome: "Snap a plant. Know what it is, what's wrong, and what to do this
  month where you live."
- State or territory (VIC, NSW, QLD, SA, WA, TAS, NT, ACT).
- Climate zone, with examples:
  - Tropical (Darwin, Cairns)
  - Subtropical (Brisbane, Gold Coast)
  - Arid (Alice Springs, Broken Hill)
  - Temperate (Sydney, Melbourne, Adelaide, Perth)
  - Cool (Canberra, Hobart, mountain areas)
- Sign in with Apple (iPhone) / Sign in with Google (Android).
- Paywall with a clear "Not now" button.

### 2. HOME: "This month in your garden"
- Current month, state and zone.
- "Plant now" from planting_calendar (crop and method: sow direct, seed tray
  or seedling). Tap for a detail card.
- "Jobs this month" from monthly_jobs.
- Big "Scan a plant" button.

### 3. SCAN
- Take a photo or pick one using the **system photo picker** (not full
  photo-library access).
- Show the common name (swapped to the Australian name using name_swaps),
  scientific name, confidence, short description, light and water needs.
- Declared weed check: match genus + species (ignore case) against
  declared_weeds for the user's country and state. If found, show a red banner
  "Declared weed in [state]", the status_note, a link to official_url, and:
  "Rules can differ by area. Check the official list or your local council."
- Native care: if the genus is in phosphorus_sensitive_genera, show: "This
  plant is sensitive to phosphorus. Use a low-phosphorus native fertiliser,
  not a general one."
- If the plant looks unhealthy: likely problems and simple next steps,
  non-chemical options first. If a product is needed, say "follow the label".
- If confidence is low, say so and suggest a clearer close-up in good light.
- Buttons: "Save to My Garden", "Scan again".
- Always show: "Plant ID can be wrong. Never eat a plant or mushroom based on
  this app."

### 4. MY GARDEN
- Saved plants: photo, name, date added, notes.
- Optional watering reminder per plant (local notification every X days).
- Add photos over time to track progress.

### 5. SETTINGS
- Change state or zone.
- "Manage or cancel subscription": opens Apple's **or Google Play's**
  subscription page depending on the phone, with a plain-English note on how
  to cancel.
- Restore purchases, privacy policy, terms, contact.
- Delete account: deletes all the user's data, photos and login (via an Edge
  Function).

## HONEST PRICING (RevenueCat)

- Free: 3 scans in total, plus the full monthly guide.
- Patch Plus (entitlement "plus"): unlimited scans and health checks,
  unlimited plants, watering reminders.
- 7-day free trial, then A$49.99/year or A$9.99/month. Same "plus"
  entitlement and AUD prices on both App Store and Google Play.
- The paywall must clearly show the price, the trial length and the date of
  the first payment.
- When a trial starts, schedule a notification 2 days before it ends: "Your
  free trial ends on [date]. Cancel anytime in Settings if it's not for you."
- No hidden close buttons and no fake countdown timers.
- Enforce the free-scan limit on the server, not just in the app. Cap every
  user at 30 scans a day to control costs.

## DATABASE (Supabase, Row Level Security on)

- profiles: id, country, state, climate_zone, created_at
- plants: id, user_id, common_name, scientific_name, notes, created_at
- plant_photos: id, plant_id, user_id, image_path, created_at
- scans: id, user_id, result_json, created_at
- planting_calendar: id, country, zone, crop_name, months (int[]), method, tip
- monthly_jobs: id, country, zone, month, job
- declared_weeds: id, country, state, scientific_name, common_name,
  status_note, official_url
- phosphorus_sensitive_genera: id, genus, note
- name_swaps: id, country, from_name, to_name

Users only see their own rows. The last five tables are read-only for users.
Add 3 example rows to each for testing, plus a CSV template for each so the
owner can upload full lists later.

## PHASES

1. App shell with all screens using fake data. Owner tests it in Expo Go
   (Android).
2. Supabase: tables, security rules, example data, Sign in with Apple and
   Sign in with Google.
3. Scan: Edge Function, Plant.id, results screen, weed check, native tip.
4. My Garden and reminders (ask notification permission on Android 13+).
5. RevenueCat paywall (App Store + Google Play), free-scan limit, trial
   reminder, delete account (in-app + web request page).
6. Store prep: placeholder icon, privacy policy draft, account-deletion web
   page, EAS builds, **TestFlight** for iPhone testers, and set up the
   **Google Play closed test** (12+ testers for 14 days in a row).

## IMPORTANT CHANGES (these override anything above)

- The owner only has an Android phone. Build for Android and iPhone from the
  start, and release on both Google Play and the App Store. Android release
  is IN this version.
- Day-to-day testing on the owner's Android phone: Expo Go first, then an
  installable Android test build.
- For iPhone, use EAS Build in the cloud and TestFlight. Friends with iPhones
  will test it. Tell the owner about cloud iPhone simulators usable in a
  browser (e.g. Appetize.io with an EAS simulator build).
- Sign-in: Sign in with Apple on iPhone, Sign in with Google on Android (both
  through Supabase).
- Subscriptions: RevenueCat for both App Store and Google Play, same "plus"
  entitlement, prices in Australian dollars.
- "Manage or cancel subscription" opens Apple's or Google Play's
  subscription page, depending on the phone.
- Photos: use the system photo picker, not full photo-library access.
- Notifications: ask for permission on Android 13 and later.
- Account deletion: keep the in-app delete button, and also make a simple web
  page where people can request deletion (Google Play requires this). Same for
  the privacy policy (public web page).
- Google Play: the owner's personal developer account needs a closed test
  with at least 12 testers for 14 days in a row before production release.
  Phase 6 covers TestFlight for iPhone testers and sets up this closed test.

## Project notes (kept up to date by Claude)

- Code lives in `patch/` inside a multi-project repo. Other folders are
  unrelated projects.
- Web pages (privacy policy, terms, delete-account request) can be hosted on
  this repo's existing GitHub Pages setup.
- Phase status: Phase 0 (brief + plan) done. Phase 1 not started.
