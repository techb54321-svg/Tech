/* The Universe Within — written content for the exhibition-planning site.
   Pure data. Australian spelling. All figures and layouts are provisional concepts. */
window.UW_CONTENT = {
  rooms: {

    /* ------------------------------------------------------------------ */
    entrance: {
      name: "The Universe Within",
      short: "Entrance",
      strapline: "A human figure opens into organs, cells and molecules as your journey begins.",
      intro: "You step from daylight into a dark, high-ceilinged room where a life-size human silhouette slowly resolves into organs, then cells, then molecular structures. Subtle sound and a softly lit floor path draw you in. A short, accessible introduction explains the route and lets you choose a guided or free visit.",
      see: [
        "Human silhouette transitioning into organs, cells and molecules on the main wall",
        "Soft floor light marking the route into the exhibition",
        "Large-print introduction panel with a tactile map of all seven rooms",
        "Simple journey overview showing the rooms in order"
      ],
      hear: [
        "Low, subtle ambient sound that shifts as the scale changes",
        "Short spoken introduction, also available as captions and Auslan video"
      ],
      do: [
        "Choose a guided route or free exploration at the choice point",
        "Pick up a sensory guide, map or audio device before entering",
        "Pause on the bench to let your eyes adjust before the darker rooms"
      ],
      physical: [
        "Introduction panel with large print, tactile map and QR codes",
        "Route-choice plinth or wall-mounted unit",
        "Bench seating for orientation and waiting",
        "Blackout drapes or light baffles at the entry threshold"
      ],
      digital: [
        "Looping silhouette-to-molecule animation (about 2–3 minutes)",
        "Gently moving floor wayfinding projection",
        "Captioned introduction video and Auslan video via QR",
        "Guided-route audio or browser-based guide content"
      ],
      equipment: [
        "2–3 laser projectors, 7,000+ lumen, short-throw, edge-blended",
        "1 ceiling-mounted projector for the floor route",
        "Media server or synchronised media players",
        "2–4 directional or focused-beam speakers",
        "Tablet kiosk or large physical buttons for the route choice"
      ],
      diy: [
        "Script and storyboard the silhouette-to-molecule sequence",
        "Animate draft sequences in Blender and After Effects",
        "Write the introduction, Easy English version and social story",
        "Build molecular models from open structural data (e.g. PDB)",
        "Prototype the floor route animation on a small projector"
      ],
      specialist: [
        "Projector selection, rigging, edge-blending and calibration (AV integrator)",
        "Colour grading and mastering for large-format projection",
        "Tactile map and signage production to accessibility standards",
        "Auslan translation and captioning by qualified providers",
        "Building surveyor review of entry, queuing and egress"
      ],
      time: "8–12 weeks content; 3–4 weeks AV installation and calibration (overlapping)",
      dependencies: [
        "Wall dimensions and surfaces measured on site",
        "Blackout and ambient light control at the entry",
        "Agreed visitor flow, timed entry and ticketing approach"
      ],
      costDrivers: [
        "Projector count, brightness and blending across a wide wall",
        "Length and render complexity of the main animation",
        "Accessibility materials: tactile map, Auslan, captions, Easy English"
      ],
      accessibility: [
        "Easy English introduction, sensory guide and social story available online before visiting",
        "Auslan video via QR and captions on all spoken content",
        "Tactile map and large-print panel at a height reachable from a wheelchair",
        "Dark-adaptation lighting at the threshold into the darker rooms",
        "Advertised quiet hours with reduced sound and brightness"
      ],
      soundSpill: "Keep the entrance soundscape subtle and use directional speakers so it does not compete with the mouth room. Acoustic drapes at the threshold help separate the spaces.",
      shadows: "Mount the main-wall projectors high or use short-throw units close to the wall so queuing visitors do not cast shadows. Place the floor projector directly overhead to keep the route clear of shadows.",
      operations: [
        "Greeter explains the route choice and hands out sensory kits",
        "Daily projector and media-server start-up check",
        "Pace entry to prevent crowding in the smaller rooms ahead"
      ],
      scienceReview: [
        "Anatomical accuracy of the organ layer within the silhouette",
        "Cell types and molecular structures shown in the transition",
        "Scale values quoted in the introduction and on-screen labels"
      ],
      scaleNote: "An on-screen scale label updates as the animation moves from body (~1.7 m) to organ, cell and molecule (~10 nm), previewing the scale ladder used throughout.",
      elements: {
        ent_proj_main: {
          name: "Silhouette-to-molecules wall",
          kind: "projection",
          purpose: "Introduces the journey from the whole body down to molecular scale.",
          interaction: "Passive; loops continuously with a visible scale label.",
          footprint: "~8 m × 4 m wall surface",
          production: "Blender and After Effects animation, edge-blended across 2–3 projectors.",
          maker: "You + specialist",
          status: "Concept"
        },
        ent_proj_floor: {
          name: "Floor route light",
          kind: "projection",
          purpose: "Marks the visitor route gently without adding signage clutter.",
          interaction: "Passive; could change colour to show guided or free route.",
          footprint: "~1.2 m × 10 m floor strip",
          production: "Simple looping animation from one overhead projector.",
          maker: "You + specialist",
          status: "Concept"
        },
        ent_intro_panel: {
          name: "Accessible introduction panel",
          kind: "physical",
          purpose: "Explains the journey in large print, tactile, audio, caption and Auslan formats.",
          interaction: "Read, touch the tactile map, or scan a QR code for Auslan video and audio.",
          footprint: "~2 m × 1.2 m wall panel",
          production: "Text written by you; panel, tactile map and Auslan video produced by specialists.",
          maker: "You + specialist",
          status: "Concept"
        },
        ent_route_choice: {
          name: "Route choice point",
          kind: "interactive",
          purpose: "Lets visitors choose a guided route or free exploration.",
          interaction: "Large buttons or touchscreen at seated height; staff can assist.",
          footprint: "~0.6 m × 0.6 m plinth",
          production: "Simple web app on a kiosk tablet, or physical buttons on a microcontroller.",
          maker: "You + specialist",
          status: "Concept"
        },
        ent_sound: {
          name: "Subtle entrance sound",
          kind: "av",
          purpose: "Sets the mood and signals each change of scale.",
          interaction: "Passive; volume reduced during quiet hours.",
          footprint: "2–4 speakers, ceiling or wall mounted",
          production: "Composed or licensed ambient soundscape; directional speaker installation.",
          maker: "You + specialist",
          status: "Concept"
        }
      },
      tour: [
        { view: "entrance", text: "You step out of the daylight into a dark, high-ceilinged room. A human silhouette glows faintly on the far wall." },
        { view: "eye", text: "As you watch, the figure opens into organs, then cells, then molecules. A small scale label tracks each step." },
        { view: "detail", text: "At the panel you can read, touch the map or scan for Auslan, then choose a guided or free route." }
      ]
    },

    /* ------------------------------------------------------------------ */
    mouth: {
      name: "Inside the Mouth",
      short: "Mouth",
      strapline: "Walk between giant teeth and watch a drink begin its journey.",
      intro: "You walk into an enlarged mouth: oversized teeth line the path, the floor rises gently like a tongue, and an arched palate overhead carries moving projections. Choose water or a sugary drink and watch how the projected sequence changes.",
      see: [
        "Oversized teeth, roughly ×40–×100 life size",
        "Tongue-inspired floor or sculptural surface with a soft texture",
        "Projections of saliva and a drink moving towards the throat",
        "Labels showing which structures are physical and which are projected"
      ],
      hear: [
        "Soft, low-level mouth sounds with nothing sudden or startling",
        "Short captioned narration on saliva and swallowing"
      ],
      do: [
        "Choose water or a sugary drink to change the projection",
        "Touch tooth surfaces where marked as touchable",
        "Follow the drink towards the digestive passage"
      ],
      physical: [
        "Oversized molars and incisors, fabricated",
        "Tongue-inspired floor or raised surface, low-rise and step-free",
        "Arched palate canopy that doubles as a projection surface",
        "Physical versus projected labels"
      ],
      digital: [
        "Saliva and drink-passage animation in two variants (water, sugary drink)",
        "Simple plaque pH illustration in the sugary drink sequence",
        "Assets adapted from the Inside the Sip prototype, including the 360° mouth video"
      ],
      equipment: [
        "2–3 short-throw projectors for walls and palate",
        "Media player with a trigger input for the drink choice",
        "Large buttons plus a touch-free proximity sensor",
        "2 small speakers with local volume control"
      ],
      diy: [
        "Write the saliva, swallowing and plaque pH script",
        "Animate both drink sequences, reusing Inside the Sip assets where suitable",
        "Model teeth in Blender from anatomical references to produce fabrication files",
        "Prototype the choice logic as a browser app"
      ],
      specialist: [
        "Fabricate teeth (CNC foam or printed shells, hard-coat, paint)",
        "Build and rig the palate canopy; structural review of fixings",
        "Tongue surface review for slip resistance, trip risk and wheelchair use",
        "Projection mapping onto the curved palate",
        "Dental or oral-health expert review of the pH content"
      ],
      time: "6–10 weeks content; 6–8 weeks fabrication (overlapping)",
      dependencies: [
        "Tooth models finalised before fabrication starts",
        "Palate structure and rigging points approved",
        "Choice controller hardware selected"
      ],
      costDrivers: [
        "Number and size of fabricated teeth",
        "Curved palate canopy structure and projection mapping",
        "Durable, slip-resistant tongue surface"
      ],
      accessibility: [
        "Step-free route; tongue surface kept low-rise with gentle transitions",
        "Clear paths of 1,000 mm+ between teeth; confirm against AS 1428.1 with an access consultant",
        "Choice buttons within wheelchair reach, with a touch-free option",
        "Captions for narration; no sudden loud sounds",
        "Tactile tooth surface at hand height for visitors with low vision"
      ],
      soundSpill: "Mouth sounds should stay quiet and local. Soft wall finishes and a curtain into the digestive passage limit spill between rooms.",
      shadows: "Place projectors behind or above the teeth, aimed away from the walking route. Visitors pass close to the walls, so test for body shadows on the palate and walls during mock-ups.",
      operations: [
        "Clean touchable surfaces and choice buttons regularly",
        "Check the tongue surface daily for wear, lifting edges or trip hazards",
        "Reset the choice system if it stalls; keep a default loop running"
      ],
      scienceReview: [
        "Sugar-to-acid and plaque pH wording, kept conservative with no wider health claims",
        "Tooth anatomy and the stated enlargement factor",
        "Roles of saliva described in the narration"
      ],
      scaleNote: "A label on one molar states its approximate enlargement (e.g. about ×60) beside a life-size tooth outline for comparison.",
      elements: {
        mouth_teeth: {
          name: "Oversized teeth",
          kind: "physical",
          purpose: "Creates the feeling of standing inside a mouth and shows tooth structure.",
          interaction: "Walk between them; selected surfaces are touchable.",
          footprint: "Each ~1–2 m tall; row of ~6–8 along each side",
          production: "Modelled in Blender, CNC-cut foam or printed shells, hard-coated and painted.",
          maker: "You + specialist",
          status: "Concept"
        },
        mouth_tongue: {
          name: "Tongue-inspired floor",
          kind: "physical",
          purpose: "Suggests the tongue underfoot while keeping the route step-free.",
          interaction: "Walk or wheel across; gentle texture only.",
          footprint: "~3 m × 6 m floor area",
          production: "Low-rise shaped floor or rubberised surface; slip and trip review required.",
          maker: "Specialist",
          status: "Concept"
        },
        mouth_palate: {
          name: "Palate canopy",
          kind: "physical",
          purpose: "Encloses the space overhead and doubles as a projection surface.",
          interaction: "Passive; carries projected movement.",
          footprint: "~4 m × 6 m arched canopy, above head height",
          production: "Lightweight framed fabric or panel canopy with projection-grade finish; rigging review needed.",
          maker: "Specialist",
          status: "Concept"
        },
        mouth_proj_walls: {
          name: "Saliva and drink projections",
          kind: "projection",
          purpose: "Shows saliva and a drink moving through the mouth towards the throat.",
          interaction: "Sequence changes with the drink choice.",
          footprint: "~2 × 6 m × 3 m wall surfaces plus palate",
          production: "Blender animation reusing Inside the Sip assets; mapped by an AV integrator.",
          maker: "You + specialist",
          status: "Concept"
        },
        mouth_choice: {
          name: "Water or sugary drink selector",
          kind: "interactive",
          purpose: "Lets visitors compare what happens with water and with a sugary drink.",
          interaction: "Press a large button or hover a hand over a sensor.",
          footprint: "~0.6 m × 0.6 m plinth",
          production: "Browser app or microcontroller triggering the media player.",
          maker: "You + specialist",
          status: "Concept"
        }
      },
      tour: [
        { view: "entrance", text: "You pass giant teeth on either side, each far taller than you. The floor rises softly like a tongue." },
        { view: "detail", text: "At the selector, you choose water or a sugary drink. The walls and palate change to show what follows." },
        { view: "eye", text: "With the sugary drink, the projection shows oral bacteria producing acid that briefly lowers plaque pH." }
      ]
    },

    /* ------------------------------------------------------------------ */
    digestive: {
      name: "Journey Through the Digestive System",
      short: "Digestion",
      strapline: "Follow a swallow down a moving passage into the stomach.",
      intro: "A ribbed, softly lit passage suggests the oesophagus, with projected waves of muscle contraction moving along it. It opens into a rounded stomach chamber where projections and spatial sound suggest churning and digestion. An open, step-free bypass runs alongside for anyone who prefers a less enclosed route.",
      see: [
        "Ribbed fabric passage with projected waves of peristalsis",
        "Rounded stomach chamber with churning projections",
        "Optional microbiome scene of magnified, illustrative organisms",
        "Labels explaining what is magnified or simplified"
      ],
      hear: [
        "Low spatial sound following the wave of contraction",
        "Gentle stomach sounds at a comfortable level"
      ],
      do: [
        "Walk through the passage or take the open bypass",
        "Pause in the stomach chamber to watch digestion",
        "Choose whether to view the microbiome scene"
      ],
      physical: [
        "Ribbed fabric oesophagus passage on a frame",
        "Stomach chamber shell",
        "Step-free open bypass route",
        "Seating in or beside the stomach chamber"
      ],
      digital: [
        "Peristalsis animation for the passage",
        "Stomach churning and digestion animation",
        "Optional microbiome scene",
        "Spatial audio mix synchronised with projections"
      ],
      equipment: [
        "2–4 short-throw projectors for passage and chamber",
        "Multichannel audio system (about 4–8 speakers)",
        "Media server synchronising projection and audio",
        "Button or sensor to start the microbiome scene"
      ],
      diy: [
        "Script peristalsis and digestion content with conservative claims",
        "Animate peristalsis and stomach motion in Blender",
        "Design illustrative microbiome organisms from microscopy references",
        "Draft the audio cue sheet for the spatial mix"
      ],
      specialist: [
        "Passage frame and fire-rated fabric: structure, fixing and certification",
        "Stomach shell fabrication and projection mapping",
        "Spatial audio design and installation",
        "Building surveyor review of the enclosed passage and egress",
        "Gastroenterologist or physiologist review of content"
      ],
      time: "8–12 weeks content; 6–8 weeks fabrication (overlapping)",
      dependencies: [
        "Fire rating of fabrics confirmed",
        "Passage width and bypass layout agreed with an access consultant",
        "Mouth room exit aligned with the passage entry"
      ],
      costDrivers: [
        "Size and fabrication of the passage and stomach shell",
        "Fire-rated fabric and framing",
        "Spatial audio system and mix"
      ],
      accessibility: [
        "Step-free, open and well-lit bypass route rejoining at the stomach",
        "Passage width 1,000 mm+; confirm against AS 1428.1 with an access consultant",
        "Signage before entry warning of an enclosed, darker passage",
        "Seating in the stomach space",
        "No rapid flicker in the peristalsis projections"
      ],
      soundSpill: "Stomach and peristalsis sounds are low-frequency and travel easily. Absorptive linings and limited bass help keep them out of the heart room.",
      shadows: "In the narrow passage, project from above or use rear projection through the fabric where possible. In the chamber, mount projectors high and centrally so visitors do not block the image.",
      operations: [
        "Check fabric tension and fixings daily",
        "Monitor the passage for crowding; staff can redirect visitors to the bypass",
        "Clean touch points and the microbiome trigger"
      ],
      scienceReview: [
        "Peristalsis described as involuntary, coordinated muscle contraction",
        "Oesophagus length (about 25 cm in adults) and any stomach volume statements",
        "Microbiome organism depictions, captions and magnification labels"
      ],
      scaleNote: "The passage is enlarged to walk through; a panel notes the adult oesophagus is about 25 cm long. The microbiome scene shows its magnification on screen.",
      elements: {
        dig_oesophagus: {
          name: "Oesophagus passage",
          kind: "physical",
          purpose: "Gives the sense of travelling down the oesophagus.",
          interaction: "Walk through; optional, with a bypass alongside.",
          footprint: "~1.5 m wide × 8 m long × 2.4 m high",
          production: "Ribbed fire-rated fabric stretched over a modular frame.",
          maker: "Specialist",
          status: "Concept"
        },
        dig_proj_peristalsis: {
          name: "Peristalsis projection",
          kind: "projection",
          purpose: "Shows waves of involuntary muscle contraction moving food along.",
          interaction: "Passive; slow waves travel in the walking direction.",
          footprint: "~8 m length of passage lining",
          production: "Blender animation, rear- or top-projected onto the fabric.",
          maker: "You + specialist",
          status: "Concept"
        },
        dig_stomach: {
          name: "Stomach chamber",
          kind: "physical",
          purpose: "Creates a rounded space to watch digestion.",
          interaction: "Enter, sit and watch.",
          footprint: "~5 m diameter",
          production: "Framed shell with fabric or panel lining, projection-grade finish.",
          maker: "Specialist",
          status: "Concept"
        },
        dig_proj_stomach: {
          name: "Stomach churning projection",
          kind: "projection",
          purpose: "Suggests churning and mixing of stomach contents.",
          interaction: "Passive loop.",
          footprint: "~12 m² curved interior surface",
          production: "Blender animation mapped onto the chamber interior.",
          maker: "You + specialist",
          status: "Concept"
        },
        dig_sound: {
          name: "Spatial digestive sound",
          kind: "av",
          purpose: "Moves sound with the contraction wave and fills the chamber.",
          interaction: "Passive; reduced during quiet hours.",
          footprint: "4–8 speakers along passage and chamber",
          production: "Sound design and multichannel installation.",
          maker: "Specialist",
          status: "Concept"
        },
        dig_microbiome: {
          name: "Microbiome scene",
          kind: "projection",
          purpose: "Introduces the gut microbiome with magnified, illustrative organisms.",
          interaction: "Optional; started by a button or sensor.",
          footprint: "~3 m × 2 m wall area",
          production: "Blender animation from microscopy references; colours illustrative, not real.",
          maker: "You",
          status: "Concept"
        },
        dig_stepfree: {
          name: "Step-free bypass",
          kind: "physical",
          purpose: "Offers an open, less enclosed route to the stomach chamber.",
          interaction: "Walk or wheel alongside the passage.",
          footprint: "~1.5 m wide × 8 m long",
          production: "Level floor with lighting and views into the passage.",
          maker: "Specialist",
          status: "Concept"
        }
      },
      tour: [
        { view: "entrance", text: "You enter a ribbed passage. Slow waves of light travel along the walls, as muscle contractions would move food." },
        { view: "overview", text: "Beside you, an open bypass runs the same way if you prefer more space." },
        { view: "eye", text: "The passage opens into the stomach. Walls churn slowly, and you can start the optional microbiome scene." }
      ]
    },

    /* ------------------------------------------------------------------ */
    heart: {
      name: "Between Heartbeats",
      short: "Heart",
      strapline: "Stand beside a giant heart as blood flow pulses around you.",
      intro: "A large, anatomically detailed heart stands at the centre of a darkened room. Wall projections of blood flow pulse in time with heartbeat audio. A hotspot shows how the sculpture could be built, and a clearly labelled demonstration lets you feel a simulated pulse.",
      see: [
        "A large anatomical heart sculpture at the centre of the room",
        "Walls pulsing with blood flow, synchronised with the heartbeat",
        "Construction hotspot showing armature, segments and finishes",
        "Labels identifying chambers, valves and major vessels"
      ],
      hear: [
        "Heartbeat audio synchronised with the projections",
        "Short captioned narration on the cardiac cycle"
      ],
      do: [
        "Walk around the heart and find the labelled chambers",
        "Press a palm pad to feel a pre-set rhythm (demonstration only)",
        "Explore the construction hotspot"
      ],
      physical: [
        "Central heart sculpture on a plinth",
        "Construction hotspot display",
        "Pulse demonstration pad",
        "Low plinth edge or barrier protecting the sculpture"
      ],
      digital: [
        "Blood-flow animation for the walls",
        "Heartbeat audio track synchronised to the projection",
        "Optional projection mapping onto the heart",
        "Construction hotspot content on a screen or panel"
      ],
      equipment: [
        "3–4 projectors for walls; 1–2 more if the heart is projection-mapped",
        "Media server with audio synchronisation",
        "Subwoofer kept at a modest level",
        "Palm pad with a small haptic transducer or vibration motor"
      ],
      diy: [
        "Prepare an anatomically accurate heart model from open or imaging-derived data",
        "Animate blood flow and the cardiac cycle in Blender",
        "Write labels and narration on cardiac anatomy",
        "Prototype the pulse pad logic on a microcontroller"
      ],
      specialist: [
        "Fabrication of the heart sculpture (large-format print, CNC or hand-sculpted)",
        "Structural engineer review of armature, plinth, fixings and floor loading",
        "Projection mapping onto the sculpture",
        "Electrical safety check of the pulse pad",
        "Cardiologist or anatomist review of sculpture and labels"
      ],
      time: "8–12 weeks content; 8–12 weeks fabrication (overlapping)",
      dependencies: [
        "Choice of heart build option",
        "Plinth location relative to projectors, and floor loading",
        "Model file ready and reviewed before fabrication"
      ],
      costDrivers: [
        "Heart build option and overall size",
        "Projection mapping onto a sculpted surface",
        "Structural work, finishing and protective coating"
      ],
      accessibility: [
        "Circulation around the sculpture 1,000 mm+; confirm against AS 1428.1 with an access consultant",
        "Pulse pad at a height reachable from a wheelchair",
        "Small tactile heart model or relief at hand height",
        "Moderate heartbeat volume; no strobe or flash effects on the beat",
        "Seating along one wall"
      ],
      soundSpill: "Low-frequency heartbeat audio carries through partitions. Limit subwoofer level and add absorptive treatment around this room.",
      shadows: "Visitors circling the heart will cross wall projection paths. Mount projectors high above the plinth and aim steeply, or use short-throw units close to the walls.",
      operations: [
        "Clean the pulse pad regularly",
        "Inspect the sculpture and plinth for damage",
        "Check audio and projection synchronisation at start of day"
      ],
      scienceReview: [
        "Heart anatomy on the sculpture and labels",
        "Blood-flow direction and timing in the projections",
        "Wording of the pulse demonstration so it cannot be mistaken for a measurement"
      ],
      scaleNote: "A panel compares the sculpture with a real adult heart (about 12 cm, roughly fist-sized) and states the enlargement factor.",
      elements: {
        heart_model: {
          name: "Central heart sculpture",
          kind: "physical",
          purpose: "Gives visitors a large, accurate heart to walk around and study.",
          interaction: "View from all sides; not climbable or touchable except marked areas.",
          footprint: "~2–3 m tall on a ~3 m × 3 m plinth",
          production: "Three options: 3D-printed segments; fabricated sculpture (CNC foam, hard-coat, paint); or a simpler form enhanced by projection mapping.",
          maker: "You + specialist",
          status: "Concept"
        },
        heart_proj_flow: {
          name: "Blood-flow walls",
          kind: "projection",
          purpose: "Shows blood flowing through the heart and vessels in rhythm.",
          interaction: "Passive; pulses with the heartbeat audio.",
          footprint: "~3 walls, each ~6 m × 3.5 m",
          production: "Blender animation, synchronised on a media server.",
          maker: "You + specialist",
          status: "Concept"
        },
        heart_audio: {
          name: "Heartbeat audio",
          kind: "av",
          purpose: "Links sound with the pulsing projections.",
          interaction: "Passive; reduced during quiet hours.",
          footprint: "2–4 speakers plus a subwoofer",
          production: "Recorded or synthesised heartbeat, mixed at a moderate level.",
          maker: "You + specialist",
          status: "Concept"
        },
        heart_pulse: {
          name: "Simulated pulse demonstration",
          kind: "interactive",
          purpose: "Lets visitors feel a rhythm through their palm. Demonstration, not a medical measurement.",
          interaction: "Press a palm on the pad; a pre-set rhythm plays. Nothing is measured or recorded.",
          footprint: "~0.6 m × 0.6 m plinth",
          production: "Microcontroller driving a haptic transducer; clear 'demonstration' labelling.",
          maker: "You + specialist",
          status: "Concept"
        },
        heart_construction: {
          name: "Construction hotspot",
          kind: "physical",
          purpose: "Shows how the heart sculpture could be built.",
          interaction: "Read panel or tap screen to step through build stages.",
          footprint: "~1.2 m × 1 m panel or screen",
          production: "Explains armature, CNC foam or printed segments, hard-coat, paint, plinth and cable routing; structural review required.",
          maker: "You + specialist",
          status: "Concept"
        }
      },
      tour: [
        { view: "entrance", text: "You enter a dark room. At its centre stands a heart taller than you, lit softly from above." },
        { view: "eye", text: "The walls pulse red and blue in time with the heartbeat, tracing blood through each chamber." },
        { view: "detail", text: "At the pad you press your palm and feel a pre-set rhythm. The label reminds you nothing is measured." }
      ]
    },

    /* ------------------------------------------------------------------ */
    cellular: {
      name: "The Cellular Universe",
      short: "Cells",
      strapline: "Shrink from tissue into a cell and down to the machinery that makes ATP.",
      intro: "Projections surround you on every wall and the floor, moving from tissue into a single cell and then toward a mitochondrion. Dense molecular scenes show the inner mitochondrial membrane and ATP synthase. Lighting is restrained so the room feels immersive without looking like science fiction.",
      see: [
        "Surround projection zooming from tissue into a cell",
        "A mitochondrion with its folded inner membrane",
        "Crowded molecular scenes including ATP synthase",
        "A scale strip showing each step in size"
      ],
      hear: [
        "A slow, quiet soundscape that changes with each scale step",
        "Optional captioned narration"
      ],
      do: [
        "Sit on the central bench and watch the zoom",
        "Check the scale strip to see how far you have travelled",
        "Stay for a full cycle or leave at any point"
      ],
      physical: [
        "Central bench seating",
        "Scale ladder wall strip",
        "Dark, matte wall and floor finishes suited to projection"
      ],
      digital: [
        "Surround and floor zoom animation",
        "Molecular scenes based on structural data",
        "Scale labels built into the animation"
      ],
      equipment: [
        "4–6 projectors for surround walls, edge-blended",
        "1–2 overhead projectors for the floor",
        "Media server for multi-projector playback",
        "Quiet ambient speakers"
      ],
      diy: [
        "Build molecular scenes from PDB structures using Blender molecular tools",
        "Plan the zoom sequence and scale steps",
        "Write the scale and simplification labels",
        "Render test sequences and check on a small mock-up"
      ],
      specialist: [
        "Multi-projector blending and calibration",
        "High-resolution rendering capacity (render farm or cloud rendering)",
        "Structural biologist review of molecular density, shapes and motion",
        "Floor projection surface durability and slip resistance"
      ],
      time: "10–14 weeks content; 3–4 weeks AV installation (overlapping)",
      dependencies: [
        "Room geometry measured for projection mapping",
        "Rendering capacity for high-resolution output",
        "Science review completed before final render"
      ],
      costDrivers: [
        "Number of projectors and blending complexity",
        "Rendering time for dense molecular scenes",
        "Expert review time"
      ],
      accessibility: [
        "Wheelchair spaces beside the central bench",
        "Signage warning of immersive zoom; avoid rapid motion that may cause discomfort",
        "No flashing; brightness changes kept gradual",
        "Captions for narration; dark-adaptation lighting at the entry"
      ],
      soundSpill: "The soundscape is quiet and may be masked by heart audio next door, so separate the rooms with drapes or a short sound lock.",
      shadows: "Visitors standing close to walls will block surround projection. Mount projectors high, encourage viewing from the bench, and project the floor from directly overhead.",
      operations: [
        "Daily blend and alignment check",
        "Manage visitor numbers so the bench view stays clear",
        "Clean the floor without damaging the projection finish"
      ],
      scienceReview: [
        "Molecular density and shapes, based on PDB structures",
        "ATP synthase structure and depiction of its rotation",
        "Inner membrane folding (cristae) and relative scale",
        "Colour conventions explained as conventions, not real colours"
      ],
      scaleNote: "A scale strip and on-screen labels mark each step: cell (~10–30 µm), mitochondrion (~0.5–1 µm wide), ATP synthase (~10 nm). Colours are conventions, not reality.",
      elements: {
        cell_proj_surround: {
          name: "Surround zoom walls",
          kind: "projection",
          purpose: "Carries visitors from tissue into a cell and toward a mitochondrion.",
          interaction: "Passive; continuous loop with scale labels.",
          footprint: "~4 walls, total ~30 m × 3.5 m",
          production: "Blender renders from PDB-based models, blended across 4–6 projectors; no artificial glow.",
          maker: "You + specialist",
          status: "Concept"
        },
        cell_proj_floor: {
          name: "Floor projection",
          kind: "projection",
          purpose: "Extends the scene underfoot for a stronger sense of immersion.",
          interaction: "Passive; walkable.",
          footprint: "~6 m × 6 m floor area",
          production: "Overhead projectors; slip-resistant, projection-suitable floor finish.",
          maker: "You + specialist",
          status: "Concept"
        },
        cell_bench: {
          name: "Central bench",
          kind: "physical",
          purpose: "Offers seated viewing and a clear vantage point away from the walls.",
          interaction: "Sit; wheelchair spaces alongside.",
          footprint: "~3 m × 0.6 m",
          production: "Simple low bench, dark finish to avoid reflecting projection.",
          maker: "Specialist",
          status: "Concept"
        },
        cell_scalebar: {
          name: "Scale ladder strip",
          kind: "physical",
          purpose: "Makes the change in scale explicit at each step.",
          interaction: "Read; tactile markers at hand height.",
          footprint: "~6 m × 0.3 m wall strip",
          production: "Printed or routed panel with subtle low-level lighting.",
          maker: "You + specialist",
          status: "Concept"
        }
      },
      tour: [
        { view: "overview", text: "You sit on the bench as the walls fill with tissue. Slowly, you move in toward a single cell." },
        { view: "eye", text: "Inside the cell the space becomes crowded. A mitochondrion appears, its inner membrane folded into cristae." },
        { view: "detail", text: "At the closest view you see ATP synthase in the membrane. The scale strip reads about 10 nanometres." }
      ]
    },

    /* ------------------------------------------------------------------ */
    signals: {
      name: "Signals Within",
      short: "Signals",
      strapline: "Start a nerve signal and watch it travel across the room.",
      intro: "A suspended neuron sculpture stretches across the room, with magnified membrane imagery on the walls. Press a button or hover your hand and a simplified signal travels along the axon in light and sound. A panel explains what has been magnified, slowed or simplified.",
      see: [
        "A suspended neuron and axon sculpture spanning the room",
        "Magnified neuronal membrane imagery on the walls",
        "A travelling signal of light along the axon",
        "A clear panel listing scientific simplifications"
      ],
      hear: [
        "Spatial sound that travels with the signal",
        "Short captioned explanation of the action potential"
      ],
      do: [
        "Press the tactile button or hover over the sensor to start a signal",
        "Follow the signal across the room",
        "Read what has been simplified and why"
      ],
      physical: [
        "Suspended neuron and axon sculpture",
        "Control plinth with tactile button and proximity sensor",
        "Simplifications panel"
      ],
      digital: [
        "Membrane and ion channel animation for the walls",
        "Signal light sequence along the sculpture",
        "Travelling spatial audio cue"
      ],
      equipment: [
        "2–4 projectors for membrane walls",
        "Addressable LED strip within the sculpture, or projection onto it",
        "Tactile button and touch-free proximity sensor",
        "Multichannel speakers for travelling sound",
        "Microcontroller or small PC linking trigger, light and sound"
      ],
      diy: [
        "Write the simplified action potential explanation",
        "Animate membrane and ion channel imagery",
        "Prototype trigger-to-signal logic in a browser or on a microcontroller",
        "Draft the simplifications panel"
      ],
      specialist: [
        "Suspended sculpture rigging and structural engineer sign-off",
        "LED or projection integration on the sculpture",
        "Interactive system programming and reliability testing",
        "Neuroscientist review of the simplifications"
      ],
      time: "8–10 weeks content; 6–8 weeks fabrication and integration (overlapping)",
      dependencies: [
        "Ceiling structure and rigging points assessed",
        "Controller hardware chosen",
        "Sculpture route aligned with speaker positions"
      ],
      costDrivers: [
        "Size and rigging of the suspended sculpture",
        "Interactive control and LED integration",
        "Multichannel audio"
      ],
      accessibility: [
        "Control within wheelchair reach, with a touch-free option",
        "Signal effects without strobe or rapid flashing",
        "Sculpture well above head height; nothing low-hanging in the path",
        "Captions and a large-print simplifications panel",
        "Clear path 1,000 mm+ around the plinth; confirm against AS 1428.1 with an access consultant"
      ],
      soundSpill: "The travelling sound is short and directional, but repeated triggers can build up. Limit volume and trigger rate so it does not intrude on the VR studio.",
      shadows: "Keep wall projectors high and angled so visitors at the control plinth do not block the membrane imagery. Use LEDs within the sculpture to avoid projecting across the room.",
      operations: [
        "Test trigger, light and sound each morning",
        "Limit repeat triggers to avoid overlapping signals",
        "Inspect rigging on a regular, documented schedule"
      ],
      scienceReview: [
        "Sequence and ion movements in the action potential",
        "Depiction of saltatory conduction along a myelinated axon",
        "Membrane and ion channel imagery"
      ],
      scaleNote: "The panel states the axon is magnified hugely and the signal slowed dramatically; real signals can travel tens of metres per second.",
      elements: {
        sig_neuron: {
          name: "Suspended neuron sculpture",
          kind: "physical",
          purpose: "Represents a neuron and its axon at room scale.",
          interaction: "Passive; lights up as the signal travels.",
          footprint: "~10 m span, suspended above 2.4 m",
          production: "Lightweight shell over LED strip, rigged from ceiling structure; structural sign-off required.",
          maker: "Specialist",
          status: "Concept"
        },
        sig_proj_membrane: {
          name: "Membrane imagery walls",
          kind: "projection",
          purpose: "Shows a magnified neuronal membrane with schematic ion channels.",
          interaction: "Reacts when a signal is triggered.",
          footprint: "~2 walls, each ~8 m × 3.5 m",
          production: "Blender animation with triggered segments on a media server.",
          maker: "You + specialist",
          status: "Concept"
        },
        sig_control: {
          name: "Signal control plinth",
          kind: "interactive",
          purpose: "Lets visitors start a signal themselves.",
          interaction: "Press a large tactile button or hover a hand over the sensor.",
          footprint: "~0.6 m × 0.6 m plinth",
          production: "Microcontroller with button and proximity sensor; programmed and tested for reliability.",
          maker: "You + specialist",
          status: "Concept"
        },
        sig_sound: {
          name: "Travelling signal sound",
          kind: "av",
          purpose: "Lets visitors hear the signal move across the room.",
          interaction: "Triggered with the signal.",
          footprint: "4–6 speakers along the sculpture",
          production: "Short sound cue panned across a multichannel system.",
          maker: "You + specialist",
          status: "Concept"
        },
        sig_label: {
          name: "Simplifications panel",
          kind: "physical",
          purpose: "States clearly what is simplified, slowed or magnified.",
          interaction: "Read; large print and audio via QR.",
          footprint: "~1.5 m × 1 m wall panel",
          production: "Lists: axon hugely magnified; time slowed dramatically; ions and channels schematic; saltatory conduction simplified; colours arbitrary.",
          maker: "You",
          status: "Concept"
        }
      },
      tour: [
        { view: "overview", text: "A long axon hangs across the room above you. The walls show a magnified membrane dotted with channels." },
        { view: "detail", text: "You press the button. A pulse of light and sound sets off along the axon." },
        { view: "eye", text: "The signal jumps between gaps in the insulation. A panel reminds you it has been slowed and simplified." }
      ]
    },

    /* ------------------------------------------------------------------ */
    vr: {
      name: "VR and Discovery Studio",
      short: "VR Studio",
      strapline: "Use a headset, a large screen or a touchscreen to explore inside the body.",
      intro: "A small, calm studio with seated and standing VR stations using Meta Quest headsets, supervised by staff. Visitors can preview short inside-the-body experiences adapted from existing prototypes, or explore on a large screen or touchscreen instead. A quiet corner offers space to sit and reflect.",
      see: [
        "Seated and standing VR stations with marked use zones",
        "Large screen showing the experiences without a headset",
        "Touchscreen anatomy explorer",
        "Quiet reflection area with soft lighting"
      ],
      hear: [
        "Headset audio, with large-screen audio at a low level",
        "Brief staff introduction on comfort and safety"
      ],
      do: [
        "Choose a short VR preview, such as a blood vessel flythrough",
        "Watch on the large screen without a headset",
        "Explore anatomy on the touchscreen",
        "Sit quietly in the reflection area"
      ],
      physical: [
        "Swivel chairs for seated stations",
        "Marked standing zones about 2 m × 2 m with clear margins",
        "Headset charging and hygiene cabinet",
        "Staff station",
        "Quiet reflection area"
      ],
      digital: [
        "VR previews adapted from Blood Vessel Explorer and Inside the Sip",
        "WebXR in the headset browser, or a native app for kiosk-style control",
        "Large-screen version of the experiences",
        "Browser-based touchscreen anatomy explorer"
      ],
      equipment: [
        "4–6 Meta Quest headsets plus spares",
        "Charging cabinet supporting a rotation of headsets",
        "Large display or short-throw projector for the big-screen alternative",
        "Touchscreen kiosk",
        "Reliable Wi-Fi and device management tools"
      ],
      diy: [
        "Adapt Blood Vessel Explorer and Inside the Sip into 3–6 minute sessions",
        "Add comfort options: seated default, comfort vignette, no forced movement",
        "Build the touchscreen explorer as a web app",
        "Write staff scripts and visitor briefings"
      ],
      specialist: [
        "Performance optimisation and testing on the target headsets",
        "Device management and kiosk mode setup",
        "Network and IT setup",
        "Developer advice on WebXR versus native app",
        "Review of age guidance, supervision and hygiene procedures"
      ],
      time: "6–10 weeks content adaptation; 2–3 weeks setup and testing",
      dependencies: [
        "Headset model and quantity chosen",
        "WebXR versus native app decision",
        "Staffing roster for supervision and cleaning"
      ],
      costDrivers: [
        "Number of headsets, spares and accessories",
        "Staffing for supervision and cleaning",
        "Development and optimisation effort"
      ],
      accessibility: [
        "Seated VR as the default; standing optional",
        "Large-screen alternative for anyone not using a headset",
        "Touchscreen at a height reachable from a wheelchair",
        "Short sessions with easy exit; staff help at all times",
        "Quiet reflection area for rest"
      ],
      soundSpill: "Most audio stays in the headsets. Keep the large-screen audio low so the studio stays calm and the quiet area remains quiet.",
      shadows: "A large display avoids projection shadows; if projecting, use a short-throw unit. Keep bright projector light and IR sources away from headset tracking cameras.",
      operations: [
        "Clean face interfaces and controllers between users; use removable covers",
        "Rotate headsets through charging during opening hours",
        "Check Meta's current age guidance (stated as 10+) and offer alternatives to younger visitors",
        "Staff supervise every active session; seated by default, sessions 3–6 minutes"
      ],
      scienceReview: [
        "Anatomical accuracy of the vessel and organ journeys",
        "Labels in the touchscreen anatomy explorer",
        "Narration and captions within the VR content"
      ],
      scaleNote: "Each VR preview opens with a short scale card and keeps a small scale indicator visible throughout.",
      elements: {
        vr_seated: {
          name: "Seated VR stations",
          kind: "headset",
          purpose: "Default, comfortable way to try the VR previews.",
          interaction: "Sit on a swivel chair; staff fit the headset and start a 3–6 minute session.",
          footprint: "~1.5 m × 1.5 m per station",
          production: "Meta Quest headsets running adapted prototypes with comfort vignette.",
          maker: "You + specialist",
          status: "Concept"
        },
        vr_standing: {
          name: "Standing VR zones",
          kind: "headset",
          purpose: "Optional standing experience for visitors comfortable with it.",
          interaction: "Stand within a marked zone; staff monitor the boundary.",
          footprint: "~2 m × 2 m each, plus clear margins",
          production: "Floor-marked zones with guardian boundaries set per headset.",
          maker: "You + specialist",
          status: "Concept"
        },
        vr_storage: {
          name: "Charging and hygiene cabinet",
          kind: "physical",
          purpose: "Stores, charges and cleans headsets between sessions.",
          interaction: "Staff only.",
          footprint: "~1.2 m × 0.5 m cabinet",
          production: "Lockable charging cabinet with space for cleaning supplies and spare face covers.",
          maker: "Specialist",
          status: "Concept"
        },
        vr_staff: {
          name: "Staff station",
          kind: "physical",
          purpose: "Base for supervising sessions and managing headsets.",
          interaction: "Staff greet, brief and assist visitors.",
          footprint: "~1.5 m × 0.8 m desk",
          production: "Desk with device management laptop and session booking list.",
          maker: "Specialist",
          status: "Concept"
        },
        vr_bigscreen: {
          name: "Large-screen alternative",
          kind: "projection",
          purpose: "Screen-based imagery showing the VR journeys without a headset.",
          interaction: "Watch, or navigate with a simple controller.",
          footprint: "~3 m × 1.7 m screen",
          production: "Desktop build of the WebXR experiences on a large display.",
          maker: "You",
          status: "Concept"
        },
        vr_touch: {
          name: "Touchscreen anatomy explorer",
          kind: "interactive",
          purpose: "Lets visitors explore anatomy at their own pace.",
          interaction: "Tap, drag and zoom through organs and systems.",
          footprint: "~1 m × 0.8 m kiosk",
          production: "Browser-based Three.js app on a touchscreen kiosk.",
          maker: "You",
          status: "Concept"
        },
        vr_quiet: {
          name: "Quiet reflection area",
          kind: "physical",
          purpose: "A calm place to rest and reflect at the end of the visit.",
          interaction: "Sit; optional reflection cards.",
          footprint: "~3 m × 3 m",
          production: "Soft seating, low lighting and acoustic panels.",
          maker: "Specialist",
          status: "Concept"
        }
      },
      tour: [
        { view: "entrance", text: "You arrive in a calm studio. A staff member explains the options and helps you choose." },
        { view: "detail", text: "You sit on a swivel chair and fly through a blood vessel for a few minutes, or watch the same journey on the large screen." },
        { view: "overview", text: "Afterwards you explore anatomy on the touchscreen, or rest in the quiet area before leaving." }
      ]
    }
  },

  /* -------------------------------------------------------------------- */
  scaleLadder: [
    { label: "Human body", size: "~1.7 m" },
    { label: "Oesophagus (adult length)", size: "~25 cm" },
    { label: "Organ (heart)", size: "~12 cm" },
    { label: "Tooth (molar crown)", size: "~1 cm" },
    { label: "Cell", size: "~10–30 µm" },
    { label: "Red blood cell", size: "~7–8 µm" },
    { label: "Gut bacterium", size: "~1–3 µm" },
    { label: "Mitochondrion", size: "~0.5–1 µm wide" },
    { label: "ATP synthase", size: "~10 nm" },
    { label: "Haemoglobin molecule", size: "~5 nm" },
    { label: "Cell membrane thickness", size: "~5–10 nm" },
    { label: "Water molecule", size: "~0.3 nm" }
  ],

  honesty: [
    "The 3D rooms are concept models, not architectural or construction drawings.",
    "The venue is illustrative; no specific building has been surveyed.",
    "Layouts are not certified for capacity, access, fire or structural safety.",
    "Dimensions, timings and cost estimates are provisional and for planning only.",
    "Renders and colours are illustrative and will change with content development.",
    "Scientific content is draft and needs review by relevant experts.",
    "No suppliers, products or quotes are implied or endorsed.",
    "Building surveyor, access consultant and engineers must review any real layout."
  ],

  generalAccessibility: [
    "Continuous step-free route through every room, with bypasses for enclosed spaces",
    "Clear paths of 1,000 mm+; confirm against AS 1428.1 with an access consultant",
    "Controls, panels and touchscreens within wheelchair reach, with touch-free options",
    "No strobe or rapid flashing; brightness changes kept gradual",
    "Captions for all narration; consider hearing loops at key points",
    "Seating in every room and a quiet reflection area at the end",
    "Dark-adaptation lighting at thresholds and compliant egress lighting throughout",
    "Quiet hours, sensory guide and social story for visitors who need them"
  ],

  generalOperations: [
    "Timed entry to manage flow through smaller and enclosed rooms",
    "Daily start-up and check of all projectors, audio and interactives",
    "Regular cleaning of touch surfaces, buttons and headsets",
    "Trained staff at the entrance, heart room and VR studio as a minimum",
    "Documented inspection of rigging, fabric and sculptures",
    "Clear procedure for AV faults, with default loops if an interactive fails",
    "Evacuation plan and staff briefing agreed with the building surveyor"
  ],

  reviewList: [
    { room: "entrance", item: "Silhouette-to-molecule sequence: anatomy and molecular accuracy", reviewer: "anatomist / structural biologist" },
    { room: "entrance", item: "Entry, queuing and egress arrangements", reviewer: "building surveyor" },
    { room: "entrance", item: "Easy English, social story and sensory guide", reviewer: "access consultant" },
    { room: "mouth", item: "Plaque pH and sugar wording", reviewer: "dentist / oral-health researcher" },
    { room: "mouth", item: "Tongue floor slip resistance and trip risk", reviewer: "access consultant / building surveyor" },
    { room: "mouth", item: "Palate canopy structure and rigging", reviewer: "structural engineer" },
    { room: "digestive", item: "Peristalsis, oesophagus and stomach statements", reviewer: "gastroenterologist / physiologist" },
    { room: "digestive", item: "Microbiome depictions and captions", reviewer: "microbiologist" },
    { room: "digestive", item: "Fire rating of fabrics and enclosed passage egress", reviewer: "building surveyor / fire engineer" },
    { room: "heart", item: "Sculpture anatomy, labels and blood-flow direction", reviewer: "cardiologist / anatomist" },
    { room: "heart", item: "Armature, plinth, fixings and floor loading", reviewer: "structural engineer" },
    { room: "heart", item: "Pulse pad electrical safety and demonstration wording", reviewer: "electrician / AV integrator" },
    { room: "cellular", item: "Molecular density, PDB-based shapes and ATP synthase depiction", reviewer: "structural biologist" },
    { room: "cellular", item: "Multi-projector blending and floor projection", reviewer: "AV integrator" },
    { room: "signals", item: "Action potential, ion channels and saltatory conduction simplifications", reviewer: "neuroscientist" },
    { room: "signals", item: "Suspended sculpture rigging", reviewer: "structural engineer" },
    { room: "vr", item: "Age guidance, supervision, hygiene and motion comfort procedures", reviewer: "VR developer / venue operations lead" },
    { room: "vr", item: "Studio layout, clear zones and wheelchair access", reviewer: "access consultant" }
  ]
};
