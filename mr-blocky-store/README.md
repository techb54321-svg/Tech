# Putting Mr Blocky in the stores

Everything needed to publish Mr Blocky: the files to upload, the pictures, the
text to paste into each store, and the answers to their forms.

| Store | Cost | What people get |
|---|---|---|
| Google Play | US$25, once | The Android app |
| Chrome Web Store | US$5, once | The extension for Chrome, Edge and Brave |
| Firefox Add-ons | Free | The extension for Firefox |
| Apple (Mac App Store) | US$99 a year | Later: see the end of this page |

Once Mr Blocky is in a store, people install him with one tap, with no warnings,
and every update you publish reaches them automatically.

## What is in this folder

- `images/`: the store pictures.
  - `play-icon-512.png`, `play-feature-graphic.png`, `play-screenshot-1.png` to `-5.png` for Google Play.
  - `chrome-promo-tile.png`, `chrome-screenshot-1.png` to `-3.png` for the Chrome Web Store (they suit Firefox too).
- `upload/mr-blocky-chrome.zip` and `upload/mr-blocky-firefox.zip`: the extension, ready to upload. `make-zips.sh` makes them again from `../mr-blocky`.
- The Android upload is `../mr-blocky-android/dist/mr-blocky-play.aab`.

The website, with the privacy policy every store asks for, is in `../mr-blocky-site`:

- Website: https://techb54321-svg.github.io/Tech/mr-blocky/
- Privacy policy: https://techb54321-svg.github.io/Tech/mr-blocky/privacy.html

## The upload key

Google Play only accepts an app bundle signed with your private **upload key**:
`mr-blocky-upload.jks`, with its password in the same zip. It was made for you
and is deliberately not in this repository, which anyone can read.

- Keep the key zip somewhere safe and private, such as your password manager
  or a private folder in your cloud storage. Never put it on GitHub.
- Every update to the Android app has to be signed with it. To make a new
  bundle: `./gradlew bundlePlay -PuploadKeystore=/path/to/mr-blocky-upload.jks -PuploadPassword=...`
  in `../mr-blocky-android`. Or give the key zip to Claude and ask for a new bundle.
- If it is ever lost or leaked, Google can replace it: Play Console → your app → Test and release → App integrity → **Request upload key reset**.

Google keeps the key that finally signs the app on people's phones ("Play App
Signing"), so the upload key alone cannot be used to change Mr Blocky.

## Google Play, step by step

New personal developer accounts must test an app with at least **12 people for
14 days in a row** before it can go public. Start finding your 12 testers now:
friends and family with an Android phone and a Google account. Allow about three
weeks in all.

### 1. Make a developer account

1. Go to https://play.google.com/console and sign in with the Google account you want to own the app.
2. Choose a **personal** account, pay the US$25, and verify your identity as asked. This can take a few days.
3. You will be asked for a contact email that is shown on the store. Consider making a separate address for Mr Blocky.

### 2. Create the app

**Create app** → App name `Mr Blocky: Stop Scrolling` → language English → **App** → **Free** → tick the declarations → **Create app**.

### 3. Store listing (Grow users → Store presence → Main store listing)

**App name** (30 characters at most)

```
Mr Blocky: Stop Scrolling
```

**Short description** (80 at most)

```
He closes social media apps for you. Dance with him to get back in!
```

**Full description**

```
Mr Blocky is a little round guy with big glasses who helps you scroll less.

Open Instagram, TikTok or another app on your list, and a moment later Mr Blocky toddles across the top of your screen, boops the close button with his nose, and shakes his head at you: "Nope not now." Then you're back on your home screen.

DANCE YOUR WAY BACK IN
Now and then he goes quiet… then asks if you want to dance with him. Say yes and the lights come up. For a minute he calls out the moves and you copy him: side to side, shake your booty, star jumps, knees up, arms up and wiggle, spin around, ta-da! Hold on to your phone: it counts your star jumps and knees up. Make it to the end and he boops the app back open, and leaves you be for 5 minutes.

YOU'RE IN CHARGE
• Choose which apps he closes
• Let yourself in for 5 minutes whenever you really need to
• Turn dance deals on or off, or ask for one to try it
• See how many times he's closed something, today and all time

PRIVATE BY DESIGN
Mr Blocky has no permission to use the internet, so nothing about you can leave your phone. No account, no ads, no tracking.

WHY HE ASKS FOR PERMISSIONS
• Usage access: to tell which app you've just opened. This stays on your phone.
• Display over other apps: so he can walk across the app you opened.
• Notifications: Android shows a small "on duty" notification while he keeps watch.

Mr Blocky isn't connected with, or endorsed by, any of the apps he closes.
```

**Graphics**: app icon `images/play-icon-512.png`, feature graphic
`images/play-feature-graphic.png`, phone screenshots `images/play-screenshot-1.png` to `-5.png`, in order.

**Store settings** (Grow users → Store presence → Store settings): category
**Productivity**; contact email; website `https://techb54321-svg.github.io/Tech/mr-blocky/`.

### 4. App content (Policy and programmes → App content)

Answer each section like this:

- **Privacy policy**: `https://techb54321-svg.github.io/Tech/mr-blocky/privacy.html`
- **Ads**: No, my app does not contain ads.
- **App access**: All functionality is available without any access restrictions.
- **Content rating**: start the questionnaire, give your email, category **All other app types**, and answer **No** to every question. It comes out as suitable for everyone.
- **Target audience**: tick **13–15**, **16–17** and **18 and over**, not the younger groups. If asked whether the app could appeal to children, answer that it is a tool for limiting your own social media use, and social media apps are for people 13 and over.
- **Data safety**: "Does your app collect or share any of the required user data types?" → **No**. That ends the form: nothing leaves the phone, because the app has no internet permission.
- **Government apps**: No. **Financial features**: none. **Health**: no health features. **News**: no.
- **Foreground service permissions**: Mr Blocky uses the **Special use** type. Describe it as:

  ```
  While switched on, Mr Blocky keeps watch for the apps the person has chosen to limit. When one is opened, he shows a short animation over it and returns the phone to its home screen. This has to run continuously in the background, and shows a notification ("Mr Blocky is on duty") the whole time. The person can switch it off at any time in the app.
  ```

  Google asks for a link to a video of the feature. Record your own phone:
  swipe down twice for Quick Settings → **Screen record**. Start recording, open
  an app on his list, let him close it, and stop. Upload the recording to
  YouTube as **Unlisted** and paste the link.

### 5. Closed test with 12 testers (Test and release → Testing → Closed testing)

1. Open the **Closed testing** track (it may be called Alpha) → **Testers** → **Create email list**. Add at least 12 testers' Google account email addresses. Save.
2. **Create new release** → upload `../mr-blocky-android/dist/mr-blocky-play.aab`. When asked about app signing, keep Google's choice (**Use Google-generated key**). Release name `1.5.0`. Release notes:

   ```
   First test version of Mr Blocky. Thanks for testing! Please keep him switched on, and tell me what you think.
   ```

3. **Next** → **Save and publish**. Google reviews it, usually within a few days.
4. Copy the **Join on the web** link from the Testers tab and send it to your testers:

   ```
   Hi! I've made an app called Mr Blocky that stops you scrolling social media: a little guy walks across your screen and closes Instagram or TikTok for you. Sometimes he'll let you back in if you dance with him.

   Would you test it for me? Google needs 12 testers to stay signed up for 14 days before it can go in the Play Store.

   1. Open this link on your Android phone and tap "Become a tester": [paste the Join on the web link here]
   2. Install Mr Blocky from the Play Store link on that page.
   3. Open it and switch on the two settings it asks for.
   4. Keep it installed for at least 14 days, and tell me what you think, good and bad.

   It's free, and it doesn't collect anything about you. Thank you!
   ```

5. Anyone who installed Mr Blocky from GitHub, you included, must **uninstall that
   version first**: the Play version is signed differently, so it cannot replace it.
6. Keep at least 12 testers signed up for 14 days in a row. Ask them for
   feedback as you go, and note what they say: Google asks about it next.

### 6. Apply for production (Dashboard → Apply for production)

Once the 14 days are up, the dashboard offers **Apply for production**. Answer
honestly; these are starting points to change to match what actually happened:

- **How did you recruit users for your closed test?** Friends and family who use social media on Android phones.
- **Describe the engagement you received from testers.** Testers kept Mr Blocky switched on with their usual social media apps on his list, so he closed those apps for them many times a day. Several tried the dance deal, using the motion sensor to count their star jumps and knees up.
- **Summarise the feedback you received and how you collected it.** Collected by message and in person. [What they liked, and what they asked for.]
- **Who is the intended audience?** People aged 13 and over who want to spend less time on social media.
- **How does your app provide value to users?** It interrupts the habit of opening social media without thinking, in a friendly way: a short animation, then back to the home screen. It offers a 5-minute break when needed, and a playful way back in through a one-minute dance, with star jumps and knees up to get you moving. It collects no data.
- **What changes did you make based on testing?** [Anything changed after testers' feedback.]
- **How did you decide it is ready?** Testers used it daily for two weeks on a range of phones, it ran reliably in the background, and no crashes were reported.

After approval: Test and release → **Production** → **Create new release** →
**Add from library** (pick the tested bundle) → roll out. When it is live,
replace "Coming soon" on the website with the Play Store link, and remove the
early-version download.

### Updates

Raise `versionCode` and `versionName` in `../mr-blocky-android/app/build.gradle`,
make a new signed bundle, and upload it: Production → Create new release. After
Google's check, usually a few hours to a day, phones update by themselves.

## Chrome Web Store (Chrome, Edge and Brave)

1. Go to https://chrome.google.com/webstore/devconsole, sign in, pay the US$5 registration fee, and verify your email.
2. **New item** → upload `upload/mr-blocky-chrome.zip`.
3. **Store listing**:
   - Description: the Google Play full description above, with "apps" read as
     "sites" and the permissions part replaced by: *Mr Blocky runs on the
     websites you visit only to check whether each one is on your list. Nothing
     is recorded or sent anywhere.*
   - Category **Lifestyle → Well-being**, language English.
   - Store icon: `../mr-blocky/icons/128.png`. Screenshots `images/chrome-screenshot-1.png` to `-3.png`. Small promo tile `images/chrome-promo-tile.png`.
   - Website and support: the website address.
4. **Privacy** tab:
   - Single purpose:

     ```
     Mr Blocky helps people spend less time on social media: when they open a site on their own list, he shows a short animation and closes the tab.
     ```

   - Justification for **storage**:

     ```
     Keeps the person's own settings: their list of sites, whether Mr Blocky is switched on, snoozes and dance deals, and a count of tabs he has closed.
     ```

   - Justification for **host permissions**:

     ```
     The person chooses which sites Mr Blocky closes and can add any site, so the content script runs on every site to check whether the current page is on their list. It only compares the page's address with the list; nothing is recorded or sent anywhere.
     ```

   - Remote code: **No, I am not using remote code**.
   - Data usage: tick none of the data types, then tick the three statements at the bottom.
   - Privacy policy: the privacy policy address.
5. **Distribution**: Public, all regions. Then **Submit for review**. Extensions that run on every site get a closer look, so allow a week or two.

**Updates**: raise `version` in `../mr-blocky/manifest.json`, run `./make-zips.sh`,
and upload the new zip under **Package**. Browsers update within a few hours of approval.

## Firefox Add-ons

1. Go to https://addons.mozilla.org/developers/ and sign in or create a Firefox account. It is free.
2. **Submit a New Add-on** → **On this site** → upload `upload/mr-blocky-firefox.zip`. Source code is not needed: nothing in it is minified or generated.
3. Listing: the same description, category **Other**, the same screenshots, and the privacy policy address. Submit.

Updates work the same as Chrome: higher version, new zip, upload.

## Apple, later

- **Mac (Safari)**: the extension can go in the Mac App Store, wrapped in a small
  app made with Xcode on your Mac (see `../mr-blocky/README.md`). It needs the Apple
  Developer Program, US$99 a year. People download it, open it once, and tick it
  in Safari's settings; Safari asks that of every extension. Updates are automatic.
- **iPhone**: Apple does not let an app see which other app is open, or draw on
  top of other apps, so the walking, booping Mr Blocky cannot work over the
  Instagram or TikTok apps. Two smaller options exist: the Safari extension on
  iPhone, which only covers social media opened in Safari; or a separate iPhone
  app using Apple's Screen Time controls, which can show a still picture of Mr
  Blocky saying "Nope not now" when a chosen app is opened, but cannot animate
  him, and needs Apple's approval to use those controls.
