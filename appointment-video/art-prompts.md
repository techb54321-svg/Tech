# Visit Recap — scene artwork prompt pack

Prompts for generating the film's 15 scene images in an image-generation tool
(Midjourney, DALL-E, Ideogram, etc.). Each prompt is complete on its own —
copy the whole block, paste, generate. A tap-to-copy version of this pack
lives at: https://claude.ai/code/artifact/dc207023-77bf-4122-a932-5619acded3bd

## How to use

1. **Set the aspect ratio to 16:9** in the tool (Midjourney: add `--ar 16:9`
   to every prompt). Aim for at least 1600×900 pixels.
2. **Generate the three character sheets first**, pick favourites, and use
   them as reference images (Midjourney character reference, or "attach an
   image" elsewhere) for every scene with people. No reference feature? The
   word-for-word repeated descriptions still keep the cast close.
3. **Do all 15 in one sitting** — same tool, same model version, same
   settings. Consistency comes from repetition.
4. **Regenerate any scene that drifts** (wrong outfit, different face, text
   appearing). Text in the image is the one thing that can't be fixed later —
   the app draws every caption itself, in four languages.

## The shared style block

Every prompt below ends with this, verbatim (the sleeping scene swaps in its
night palette):

> Style: warm modern storybook illustration, flat colour fills with bold
> dark-brown ink outlines of varied thickness, textured cream paper
> background, subtle film grain, soft gentle light. Palette: coral red
> #E2574C, sage green #5F8A72, honey gold #EEC06C, soft sky blue #CFE0E2,
> dark warm brown #3A3330, cream paper #FBF5EA. Composition: wide 16:9
> cinematic frame, one clear focal subject, generous negative space, all
> important content inside the central 70% of the frame. No text, no
> letters, no numbers, no logos, no watermark.

## The cast (repeat these descriptions verbatim)

- **Mai (the patient, our hero):** a warm-hearted woman around 60 with tan
  skin, short dark-brown hair swept to one side, round friendly face,
  wearing a soft coral-red knitted jumper
- **The doctor:** a kind doctor in his 40s with brown skin and short black
  hair, wearing a white coat over a sage-green shirt with a stethoscope
  around his neck
- **The nurse:** a friendly nurse with black hair in a neat bun, wearing
  sage-green scrubs
- **The husband:** a man around 60 with curly grey-flecked hair, wearing a
  honey-gold jumper
- **The grandchild:** a small happy grandchild with two little rounded hair
  puffs, wearing a soft sky-blue top

## Character sheet prompts

**A. Mai** (`cast_mai.png`)

```
Character design sheet of one single character: a warm-hearted woman around 60 years old with tan skin, short dark-brown hair swept neatly to one side, a round friendly face and a gentle smile, wearing a soft coral-red knitted jumper and dark trousers. She stands relaxed in full-body front view, arms at her sides, centred on a plain textured cream paper background. Style: warm modern storybook illustration, flat colour fills with bold dark-brown ink outlines of varied thickness, subtle film grain, soft gentle light. Palette: coral red #E2574C, sage green #5F8A72, honey gold #EEC06C, soft sky blue #CFE0E2, dark warm brown #3A3330, cream paper #FBF5EA. No text, no letters, no numbers, no logos, no watermark.
```

**B. The clinic team** (`cast_clinic.png`)

```
Character design sheet of two characters standing side by side in full-body front view, relaxed and friendly, centred on a plain textured cream paper background. Left: a kind doctor in his 40s with brown skin and short black hair, wearing a white coat over a sage-green shirt, with a stethoscope around his neck. Right: a friendly nurse with black hair in a neat bun, wearing sage-green scrubs. Style: warm modern storybook illustration, flat colour fills with bold dark-brown ink outlines of varied thickness, subtle film grain, soft gentle light. Palette: coral red #E2574C, sage green #5F8A72, honey gold #EEC06C, soft sky blue #CFE0E2, dark warm brown #3A3330, cream paper #FBF5EA. No text, no letters, no numbers, no logos, no watermark.
```

**C. The family** (`cast_family.png`)

```
Character design sheet of two characters standing side by side in full-body front view, relaxed and smiling, centred on a plain textured cream paper background. Left: a man around 60 with curly grey-flecked hair and tan skin, wearing a honey-gold jumper. Right: a small happy grandchild with two little rounded hair puffs, wearing a soft sky-blue top. Style: warm modern storybook illustration, flat colour fills with bold dark-brown ink outlines of varied thickness, subtle film grain, soft gentle light. Palette: coral red #E2574C, sage green #5F8A72, honey gold #EEC06C, soft sky blue #CFE0E2, dark warm brown #3A3330, cream paper #FBF5EA. No text, no letters, no numbers, no logos, no watermark.
```

## Scene prompts

Each heading shows the exact file name the returned image must use — the app
looks pictures up by these IDs. Scene-specific text below; append the shared
style block from above to complete each prompt (the artifact page has them
pre-assembled).

**01 `doctor_patient.png`** — A flat 2D animated film still: inside a sunny
clinic consulting room, [the doctor] explains something gently with one hand
raised mid-gesture to [Mai], who listens and nods. A large window pours a
soft shaft of golden light across the room; a potted plant and a simple
abstract wall poster in the background. The two figures stand slightly right
of centre with a calm empty speech-bubble shape floating between them.

**02 `taking_tablet.png`** — In a bright morning kitchen, [Mai] holds one
single small white-and-coral tablet in her open palm and looks at it calmly.
A tall glass of clear water waits on the wooden counter beside her; morning
sunlight streams through the window. The tablet and the glass are the clear
focal points.

**03 `calendar.png`** — [Mai] reaches up to a large wall calendar and
circles one day with a coral marker. The calendar grid is made of soft blank
rounded squares containing no numbers and no letters, with one square
circled boldly in coral red. A small potted plant sits below, soft morning
light.

**04 `blood_test.png`** — In a calm friendly clinic corner, [the nurse]
reassures [Mai] with a gentle smile. On the table between them a small
blood-sample tube with a tiny heart-shaped label sits in a wooden rack, half
filled with coral red. The mood is completely calm and unafraid, soft warm
light.

**05 `drinking_water.png`** — In a bright kitchen, [Mai] happily drinks from
a tall glass of clear water with tiny sparkles and bubbles rising in it. A
second full glass of water stands large in the foreground. Fresh clean
morning light with sky-blue and cream tones.

**06 `walking.png`** — [Mai] walks cheerfully mid-stride along a winding
park path, arms swinging. Rolling sage-green hills behind her, one round
friendly tree gently swaying, small birds in the sky and a warm gold sun. A
few soft coral breeze lines sweep past her.

**07 `healthy_food.png`** — A generous welcoming dinner table seen straight
on: a large plate holding a bright red apple and fresh green broccoli, a
steaming bowl of soup beside it, and a simple fork and knife. Warm and
appetising, painted in coral, sage green and honey gold. (No people — an
easy one.)

**08 `heart.png`** — A big softly glowing storybook heart in coral red,
centred, with two faint rings radiating out around it and a single smooth
calm pulse line travelling horizontally across the whole frame behind it.
Minimal warm emblem-like composition with lots of empty cream paper around
it.

**09 `lungs.png`** — A friendly pair of rounded softly-drawn lungs in coral
red, centred, with sage-green breath swirls curling in from either side and
tiny air motes drifting around them. Gentle calm emblem-like composition
with lots of empty cream paper around it.

**10 `sleeping.png`** — A quiet night bedroom painted in deep indigo blue
with cream linework: [Mai] sleeps peacefully in bed, eyes closed, her
rounded blanket gently rising with breath. Through the window a golden
crescent moon and small twinkling stars; a tiny warm lamp glows honey-gold
on the bedside table. *Swap the palette line for:* deep indigo night blue
#333A63, warm cream #F6EAD6 linework, honey gold #EEC06C, soft coral red
#E2574C accents.

**11 `warning.png`** — A large rounded warning triangle with a bold
exclamation mark inside it, drawn softly in coral red with one faint ring
radiating around it — serious but kind, not frightening. Beside it [the
doctor] calmly gestures toward it with an open reassuring hand. (Add: no
words inside the triangle other than the exclamation mark.)

**12 `phone_call.png`** — At home in warm lamplight, [Mai] holds a phone to
her ear with a reassured expression. Three curved coral sound-wave arcs
travel across the frame from her phone toward a small friendly clinic
building with a coral cross on the right side. Cosy and calm.

**13 `question.png`** — [Mai] stands thinking with one hand on her chin,
looking up at one large soft coral question mark floating in the air beside
her, with a smaller fainter question mark echoing behind it and two little
thought-bubble dots rising from her head. Minimal warm background. (This is
also the app's fallback picture, so it matters.)

**14 `family.png`** — [Mai] walks hand in hand through a sunny park with
[the husband], and between them [the grandchild]. Rolling sage-green hills,
small birds and a warm gold sun behind them; a single coral heart floats
gently above the three of them.

**15 `thumbs_up.png`** — [Mai] cheers joyfully with both arms raised high
and a big smile, while a large friendly thumbs-up symbol floats beside her
and small coral and gold confetti sparks scatter through the air. A warm
gold sun in the corner. The feeling is celebration, relief, good news.

## What to send back

- One image per scene, 16:9, at least 1600×900, PNG or high-quality JPG.
- Named exactly by scene ID (rename after download is fine).
- No text baked into any image — the app draws all captions itself.
- Optional but powerful: for favourite scenes, also a background-only
  version with the people erased (`<id>_bg.png`, via the tool's
  remove-object brush) and the characters cut out on transparency
  (`<id>_fg.png`, via any background remover). With layers the camera can
  move *through* the scene with real depth; flat images still animate well
  with camera pushes, light and crossfades.
