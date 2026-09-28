# The Universe Within — exhibition concept model

An interactive planning website for a proposed Melbourne exhibition, *The Universe Within*: a journey inside the human body across seven connected rooms in an illustrative brick warehouse.

It combines a navigable 3D walkthrough with planning tools:

- **3D venue (Three.js)** with orbit, eye-level walking, several viewpoints per room, a guided tour and free exploration.
- **Clickable floor plan** with the visitor route, a step-free alternative, installation markers and your current viewpoint.
- **Installations** you can switch on and off, each with its purpose, visitor interaction, footprint and production approach. *Colour by type* separates projected imagery, physical installations, headset experiences, interactive controls and AV equipment.
- **Room settings**: dimensions, projection coverage, model scale, lighting, visitor figures and how much content you make yourself. Rooms can be reordered, combined or removed.
- **Animated projection previews** with play, pause, timeline, chapters and synthesised sound (muted until you turn it on).
- **Budget** in AUD with one-off and recurring costs, hire or purchase, GST, contingency, editable rates and overrides. Sourced, derived and provisional figures are labelled.
- **Scenarios**: compact pilot, polished exhibition and flagship, with rendered side-by-side comparisons.
- **Concept renders**: the AI-generated renders you supplied (mouth, digestive hall, VR studio) in the walkthrough's *Concept render* view, with hotspots that open each installation and review notes on where they depart from anatomy or the brief. Rooms without a render list suggested prompts for making one. When the page is published with the `assets` and `db` capabilities, new renders can be uploaded and their hotspots placed.
- **Save and export**: saves stay in this browser's local storage; configurations can also be downloaded or copied as JSON, and a room-by-room plan can be exported as Markdown with a budget CSV.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `app.css` | Page structure and styling |
| `js/world.js` | Procedural 3D venue, installations, projection surfaces, navigation |
| `js/projections.js` | Canvas animations used for projections and previews |
| `js/layout.js` | Turns the room list into a floor plan |
| `js/model.js` | Rooms, installations, scenarios, equipment and budget model |
| `js/content.js` | Room planning content |
| `js/sources.js` | Australian reference figures with links |
| `js/audio.js` | Synthesised sound sketches |
| `js/renders.js` | Concept render list: files, captions, hotspots and review notes |
| `js/render-prompts.js` | Suggested image prompts for rooms without a render |
| `js/app.js` | Interface, floor plan, inspector, concept renders, tour, budget, comparison, save and export |
| `assets/renders/` | Your three concept renders with the web page's overlay text removed, full size and 960 px wide |

## Running locally

Serve the folder over HTTP (for example `npx http-server universe-within`) and open `index.html`. Three.js loads from the jsDelivr CDN.

## Honesty notes

Concept renders are AI-generated mood and design references, not construction drawings; the areas under the removed overlay text are filled in, not original detail. The venue is illustrative, and its dimensions are editable assumptions. The heart and other models are provisional representations, not anatomical models. Projection imagery is procedural placeholder content. Costs are planning estimates: sourced figures cite a published reference, and everything else is a provisional assumption, not a quote. Nothing here certifies capacity, access or safety.
