# Patch

An AI garden helper for Australian home gardeners (Expo / React Native,
Android + iPhone). The full brief is in [`CLAUDE.md`](CLAUDE.md).

## Try it on your Android phone (Expo Go)

You need a computer (Windows or Mac) on the same Wi-Fi as your phone.

1. **Install Node.js** (one time): go to https://nodejs.org, click the big
   **LTS** download button, open the file and click **Next** through the
   installer.
2. **Install Expo Go** on your phone from the Google Play Store.
3. **Get the code**: on GitHub, open this repository, switch to the branch
   `claude/practical-heisenberg-viblms`, click the green **Code** button,
   then **Download ZIP**. Unzip it.
4. **Open a terminal in the `patch` folder**:
   - Windows: open the `patch` folder in File Explorer, click the address
     bar, type `cmd` and press Enter.
   - Mac: right-click the `patch` folder → **New Terminal at Folder**.
5. Type these two commands, pressing Enter after each (the first takes a few
   minutes the first time):
   ```
   npm install
   npx expo start
   ```
6. A QR code appears. Open **Expo Go** on your phone, tap **Scan QR code**,
   and point it at the screen. Patch opens.

If the phone can't connect, stop the server (Ctrl + C) and run
`npx expo start --tunnel` instead.

## Project layout

- `src/app/`: screens (Expo Router: each file is a screen)
- `src/components/`: shared building blocks (buttons, cards, paywall, results)
- `src/lib/`: logic (scan rules, data access, photos, dates/locations)
- `src/data/`: data types and Phase 1 sample data
- `src/state/`: app-wide state saved on the phone
- `src/theme/`: colours (light and dark)

## Developer notes

- Install packages with `npx expo install <name>` (picks versions that match
  the Expo SDK). In the cloud dev container, prefix with `EXPO_OFFLINE=1`
  because Expo's online version check is blocked there.
- Before committing: `npx tsc --noEmit` and `npx expo lint`.
