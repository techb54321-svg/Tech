/* The Universe Within — prompt pack for photoreal AI concept renders.
   Written to match the look of the three renders the client supplied (giant mouth,
   digestive hall, brick-warehouse VR studio). Pure data. Australian spelling.
   Every image made from these prompts is an AI concept render, not a final design,
   and should be labelled that way on the site. */
window.UW_RENDER_PROMPTS = {

  style: "Photoreal architectural concept photograph of an immersive science exhibition installed inside a converted nineteenth-century red-brick warehouse and stables in Melbourne, with exposed timber roof trusses, arched brick openings and a polished concrete floor. Dim, warm, museum-grade lighting: low warm-white spotlights on the physical pieces, deep soft shadows, and large wall projections supplying much of the ambient light. Large physical sculptures with realistic, subtly wet biological surfaces that still read as crafted exhibits. Real visitors of mixed ages in everyday clothes for scale, seen from behind or in three-quarter view, faces never the focus. Shot like a cinematic 35 mm full-frame photograph: natural colour, shallow depth of field, fine grain, wide 16:9 (or 21:9) framing. No text anywhere in the image.",

  negative: "text, lettering, captions, readable signage, numbers, labels, logos, brand marks, watermarks, signatures, UI overlays, cartoon or stylised anatomy, Valentine heart shape, toy-like plastic look, neon colours, sci-fi holograms, glowing molecules, bloom, lens flare, god rays, heavy haze or fog, particle sparkles, generic futuristic interface, blood, gore, open wounds, horror, rotting teeth, extra or fused teeth, extra fingers, distorted hands, distorted faces, visitors looking at the camera, crowds, fisheye distortion, oversaturated colour, low resolution, smeared artefacts",

  tips: [
    "Paste the room prompt first, then the shared style paragraph; put the negative list in the tool's 'avoid' or negative field, or add it after the word 'Avoid:'.",
    "Set the aspect ratio to 16:9 (or 21:9 for wide hero images) before generating, rather than cropping a square image afterwards.",
    "Generate four to eight variations of each prompt and pick the most believable one; re-run with a small wording change rather than heavily editing a flawed image.",
    "Check every result for stray text, logos, extra teeth or fingers and wrong anatomy, and have the clinical reviewer sign off anatomy before anything is shown publicly.",
    "Upload the chosen image to that room's slot; the site labels it as an AI-generated concept render, not a construction drawing. Keep that label wherever else you use the image."
  ],

  rooms: {

    /* ------------------------------------------------------------------ */
    entrance: [
      {
        view: "Entrance view",
        prompt: "Wide 16:9 photograph from just inside heavy black blackout drapes at the entry of a dark, high-ceilinged converted red-brick warehouse with exposed timber trusses. Camera at 1.6 m eye level, 24 mm lens, looking straight at an 8 m × 4 m edge-blended projection on a smooth matte wall set into the brick: on the left a life-size standing human silhouette whose outline fills with realistic organs, flowing rightwards into clusters of cells and then into dense molecular structures, all in muted natural tones. A soft warm strip of projected floor light about 1.2 m wide leads from the camera towards the wall. Three visitors in everyday coats walk the path, seen from behind, lit only by the projection. A low timber bench sits to one side. Quiet, restrained, awe-filled.",
        notes: "Check the sequence reads left to right as body, organs, cells, molecules; organs sit in plausible positions; the image is clearly projected onto a wall, not a glowing screen; no scale labels or words are baked in (add those on the site)."
      },
      {
        view: "Visitor eye level at the choice point",
        prompt: "Wide 16:9 photograph at 1.6 m eye level, 35 mm lens, in the dim entrance hall of a converted red-brick warehouse with timber trusses above. In the foreground, a matte charcoal plinth about 0.6 m square at seated height carries two large, softly backlit round buttons, one warm amber and one pale blue-grey, for a guided or free route; a visitor in a wheelchair and a standing companion reach towards them, seen in three-quarter view from behind. To the right, a 2 m × 1.2 m introduction panel with large blocks of type shown as soft illegible shapes and a raised tactile map of seven rooms, gently lit from above. Behind them, the huge silhouette-to-cells projection fills the far wall, out of focus. Warm museum lighting, shallow depth of field.",
        notes: "Check the plinth is reachable from a seated position and the panel has no fake readable words or icons. The tactile map should look raised and touchable."
      },
      {
        view: "Close-up of the silhouette projection",
        prompt: "21:9 cinematic photograph, 50 mm lens at 1.6 m eye level, standing about 4 m from the entrance projection wall in a dark brick warehouse. The frame is filled by the mid-point of the looping animation: the torso of a life-size human silhouette with anatomically placed heart, lungs, liver and intestines rendered as realistic, softly lit tissue, dissolving at its edge into rounded cells with visible nuclei, which in turn resolve into densely packed protein and membrane structures in muted ochre, rose and slate tones. Two visitors stand in silhouette along the lower edge for scale, one pointing. The faint texture of the matte wall is visible through the projected image. Restrained and scientific, with no glow.",
        notes: "Ask the clinical reviewer to check organ placement. Cells and molecules should look like careful scientific illustration, not glowing orbs or a galaxy."
      }
    ],

    /* ------------------------------------------------------------------ */
    mouth: [
      {
        view: "Entrance view",
        prompt: "Wide 16:9 photograph at 1.6 m eye level, 24 mm lens, looking into a walk-through giant human mouth built inside a converted red-brick warehouse with exposed timber trusses. Two curved rows of fabricated teeth, each 1–2 m tall, line the path in correct anatomical order, incisors at the front and molars deeper in, with slightly translucent ivory enamel and a wet sheen on realistic pink gums. Underfoot, a gently rising, step-free tongue-inspired floor in soft matte pink with a subtle papillae texture, edged with slim steel handrails. Overhead, an arched palate canopy carries a moving projection of saliva and a clear drink flowing towards the throat. Four visitors in everyday clothes walk away from the camera. Warm spotlighting, shallow depth of field.",
        notes: "Check the tooth order and count in each row (no doubled rows or fused teeth), that the gums read as a crafted sculpture rather than real flesh, that the floor looks step-free with handrails, and that the palate imagery is clearly projected."
      },
      {
        view: "Visitor eye level at the drink choice",
        prompt: "Wide 16:9 photograph, 35 mm lens at 1.6 m eye level, inside the giant-mouth installation in a dim brick warehouse. In the foreground, a child and an adult stand in three-quarter view from behind at a low charcoal plinth with two large tactile buttons, one marked by a simple raised glass-of-water shape and one by a raised soft-drink bottle shape; the child's hand presses one. Beyond them, oversized realistic molars with wet ivory enamel frame the view, and the wall projection shows an amber sugary drink washing over a magnified tooth surface with a thin, softly shaded plaque layer, drawn in a clear scientific-illustration style. Warm, low museum lighting; teeth sharp, background softly out of focus.",
        notes: "Keep the sugary-drink imagery conservative: plaque and acid only, no rotting teeth, holes or decay drama. Buttons should use shapes, not words, and no real drink brands."
      },
      {
        view: "Close-up of a touchable molar",
        prompt: "Close-up 16:9 photograph, 50 mm lens at about 1.4 m height, of one oversized lower molar about 1.5 m tall in the walk-through mouth installation inside a converted brick warehouse. Its crown shows realistic cusps and fissures, the enamel slightly translucent at the edges with faint natural staining, rising from glossy pink gum sculpted with fine surface detail. A marked touchable zone on the side of the crown has a slightly more matte, worn finish; a visitor's hand rests on it, seen from the side. Beside it, a small wall-mounted outline of a life-size tooth for comparison, with no readable text. A warm raking spotlight reveals texture, while more teeth and the palate projection fall into soft background blur.",
        notes: "Check the molar anatomy (cusps, fissures, crown sitting in gum) and the hand (five fingers, natural pose). The touchable zone should look deliberate and durable."
      }
    ],

    /* ------------------------------------------------------------------ */
    digestive: [
      {
        view: "Entrance view: passage and open route",
        prompt: "Wide 21:9 photograph at 1.6 m eye level, 24 mm lens, inside a converted red-brick warehouse with timber trusses. On the left, the mouth of an 8 m walk-through oesophagus-inspired passage about 1.5 m wide and 2.4 m high, lined with soft, moist-looking pink fabric gathered into longitudinal mucosal folds that run in the direction of travel, never rings or hoops. A slow projected wave of muscle contraction travels along the lining. On the right, running parallel, a level, open, step-free route with low warm floor lighting and wide views into the passage. Visitors walk both routes, seen from behind, one using a walking frame. The far end opens into a warmer, larger stomach space. Dim, warm and cinematic.",
        notes: "Most important: the folds must run lengthways. Circular ribs or hoops make the passage read as a trachea with cartilage rings, so reject those (the supplied render has this problem). Check the open route is clearly level and unenclosed."
      },
      {
        view: "Stomach space at visitor eye level",
        prompt: "Wide 16:9 photograph, 28 mm lens at 1.6 m eye level, in a tall converted brick warehouse with exposed timber trusses. At centre, a monumental J-shaped stomach sculpture roughly 5 m across, anatomically shaped with a domed fundus, body, greater and lesser curvature and a narrowing pylorus, the oesophagus entering at the cardia just below the fundus. Its outer surface is a realistic satin pink-tan with fine branching blood vessels. A wide opening in its side reveals the interior lined with deep, thick rugae folds, lit by slow churning projections of mixing stomach contents in muted amber and rose. Large wall projections behind show magnified stomach lining. Small groups of visitors stand or sit on a low bench, seen from behind. Warm museum lighting.",
        notes: "Rugae should be irregular, mostly lengthways ridges, not neat concentric rings. Check the overall stomach shape and vessel entry points, and that projections look like soft tissue rather than lava or fire."
      },
      {
        view: "Optional microbiome scene",
        prompt: "Wide 16:9 photograph, 35 mm lens at 1.6 m eye level, of a semi-enclosed alcove off the digestive hall in a converted brick warehouse. A 3 m × 2 m wall projection shows a magnified, scientifically informed scene of gut bacteria: rod-shaped and round microbes of varied sizes, some in short chains, resting in a translucent mucus layer above the tips of intestinal villi, rendered like a careful microscopy-based illustration in muted, clearly illustrative colours of sage, ochre and dusty rose. Two visitors sit on a low padded bench watching, seen from behind, their heads softly silhouetted against the image. Warm low light grazes the brick edges of the alcove. No glow, no sparkles, no creatures with faces.",
        notes: "Colours are illustrative, not real, so keep that label on the site. Organisms should look plausible (rods, cocci, chains), not like cartoon monsters or spiky viruses. No magnification numbers in the image."
      }
    ],

    /* ------------------------------------------------------------------ */
    heart: [
      {
        view: "Entrance view",
        prompt: "Wide 21:9 photograph, 24 mm lens at 1.6 m eye level, from the doorway of a darkened room in a converted red-brick warehouse with timber trusses. Centred, a large, anatomically accurate human heart sculpture about 2.6 m tall on a low dark plinth about 3 m square with a slim protective edge, in natural anatomical orientation, showing the aortic arch, pulmonary trunk, superior vena cava, auricles and coronary vessels running over its surface. Three surrounding walls carry pulsing projections of blood flowing through vessels in deep red and muted rose, softly lighting the brick edges. A few visitors in everyday clothes stand around it, seen from behind, dwarfed by it. Focused warm spotlights, restrained drama, no haze.",
        notes: "Check anatomy: aorta arching over the pulmonary trunk, great vessels in plausible positions, coronary vessels on the surface, apex at the bottom. Reject symmetrical or Valentine-style hearts. The site states the real heart is about 12 cm."
      },
      {
        view: "Build option A: 3D-printed ivory model",
        prompt: "Wide 16:9 photograph, 35 mm lens at 1.6 m eye level, in a darkened room of a converted brick warehouse. At centre, on a low charcoal plinth, stands a 2.6 m anatomical human heart sculpture made from 3D-printed segments in warm ivory resin, the fine horizontal print layer lines and neat segment joins subtly visible, like an enlarged museum study model. It shows accurate great vessels, auricles, and coronary arteries and veins in raised relief, all in one uniform ivory tone that reveals form through light and shadow. Warm spotlights rake across it from above. Behind, the walls pulse with realistic blood-flow projections in muted reds. Two visitors in three-quarter view study it closely. Shallow depth of field.",
        notes: "Look for a believable print finish, with subtle segments and layer lines rather than a toy look. Anatomy must stay readable without colour cues. Use it to compare look and cost with options B and C."
      },
      {
        view: "Build option B: hand-finished fabricated sculpture",
        prompt: "Wide 16:9 photograph, 35 mm lens at 1.6 m eye level, in a darkened converted red-brick warehouse with timber trusses. A 2.6 m anatomical human heart sculpture on a low dark plinth, fabricated from carved foam, hard-coated and hand-painted with museum realism: deep red-brown heart muscle, pale yellow fat along the coronary grooves, darker coronary veins and brighter arteries, and a satin wet-look varnish catching the warm spotlights. The aorta, pulmonary trunk and venae cavae end in clean, smooth-cut openings, not torn edges. The surrounding walls carry pulsing blood-flow projections. A parent and child stand at the plinth edge in three-quarter view, the child looking up. Rich but restrained, no gore.",
        notes: "The most realistic option. Check it reads as a crafted exhibit (clean vessel ends, even varnish) rather than a real organ, with no blood, drips or gore."
      },
      {
        view: "Build option C: matte white sculpture with projection mapping",
        prompt: "Wide 16:9 photograph, 28 mm lens at 1.6 m eye level, in a dark room of a converted brick warehouse. A 2.6 m anatomical heart sculpture on a low plinth, finished in smooth matte white, is precisely projection-mapped from two small projectors mounted on the timber trusses: realistic muscle texture and a slow travelling contraction are projected onto its surface, while a narrow strip along one side stays bare white, openly showing the technique. Projected light spills faintly onto the plinth. The walls carry synchronised pulsing blood-flow projections in muted red. Three visitors stand around it, seen from behind. Crisp mapping edges, no haze, no glow.",
        notes: "Check the projected texture sits convincingly on the form and the projectors are visible but discreet. The bare strip is optional; drop that phrase for a fully mapped look."
      },
      {
        view: "Close-up of the pulse demonstration plinth",
        prompt: "Close-up 16:9 photograph, 50 mm lens at about 1.3 m height, in the darkened heart room of a converted brick warehouse. A waist-height matte charcoal plinth about 0.6 m square has a smooth, slightly recessed palm-shaped pad in soft grey silicone; an adult visitor's open hand presses flat on it, the sleeve of an everyday jumper visible. A soft warm downlight picks out the hand and pad. There is no screen, no numbers and no medical equipment. In the blurred background, the giant heart sculpture and pulsing red wall projections fill the frame. Calm, tactile and intimate.",
        notes: "It must read as a simple demonstration, not a medical device: no screens, readouts, ECG traces, cuffs or clinical styling. Check the hand has five natural fingers."
      }
    ],

    /* ------------------------------------------------------------------ */
    cellular: [
      {
        view: "Entrance view",
        prompt: "Wide 21:9 photograph, 20 mm lens at 1.6 m eye level, from the doorway of a room in a converted brick warehouse whose four walls and floor are covered by seamless edge-blended projection. The walls show a crowded, scientifically informed molecular landscape inside a cell: tightly packed proteins, ribosomes and membranes rendered as matte, softly shaded forms in muted conventional colours, like a careful molecular illustration based on structural data. At centre, a long, low dark bench about 3 m long, with visitors seated and a wheelchair user alongside, all seen from behind as silhouettes against the imagery. A slim scale strip runs along one wall at hand height. Restrained lighting; no neon, no glow, no sparkles.",
        notes: "The molecular scene should feel dense and crowded, not sparse floating blobs. Colours are conventions, so keep that label on the site. Reject any bloom, glowing particles or sci-fi tunnel look."
      },
      {
        view: "Visitor eye level from the bench: mitochondrion",
        prompt: "Wide 16:9 photograph, 28 mm lens at 1.2 m seated eye level, from behind two visitors on a low dark bench in an immersive projection room inside a converted brick warehouse. The front wall is filled by a single mitochondrion, cut away to reveal its smooth outer membrane and the folded inner membrane forming cristae, set among the crowded cytoplasm of a cell, with the matte, carefully shaded density of scientific molecular illustration in muted salmon, olive and blue-grey. The side walls and floor continue the cellular scene without seams. Faint projector light falls on the visitors' shoulders. Calm, contemplative and precise, with no glow.",
        notes: "Check for a double membrane with inner folds (cristae) and a crowded surrounding cytoplasm. It should look like careful illustration, not a glowing capsule or a bean floating in empty space."
      },
      {
        view: "Close-up of the inner membrane and ATP synthase",
        prompt: "21:9 photograph, 50 mm lens at 1.6 m eye level, of a visitor in three-quarter view from behind, standing close to a large projected wall in a dark converted brick warehouse. The projection shows a magnified section of the inner mitochondrial membrane: a lipid bilayer seen edge-on, studded with many mushroom-shaped ATP synthase complexes, their rounded heads on slender stalks projecting into the matrix, crowded among other membrane proteins in the dense, scientifically informed style of molecular illustration, with muted colours and soft matte shading. Near the visitor's hand, a slim scale strip with tactile markers runs along the wall, softly lit from below, with no readable text. No glow, no neon.",
        notes: "ATP synthase should look like a knob-on-stalk complex embedded in the membrane, repeated many times, not a glowing turbine. The scale strip should carry no invented numbers; real labels are added on the site."
      }
    ],

    /* ------------------------------------------------------------------ */
    signals: [
      {
        view: "Entrance view",
        prompt: "Wide 21:9 photograph, 24 mm lens at 1.6 m eye level, in a dim converted red-brick warehouse with exposed timber trusses. A suspended neuron sculpture spans about 10 m across the room above head height: a cell body with branching dendrites at one end, then a long axon wrapped in pale segmented myelin sheaths separated by narrow nodes, ending in fine axon terminals. A soft, warm amber pulse of light travels along the axon. Two side walls carry large projections of a magnified neuronal membrane with schematic ion channels in muted blue-grey and ochre. Visitors below, seen from behind, turn their heads to follow the signal. Warm, restrained lighting; no neon, no haze.",
        notes: "Check the anatomy: dendrites and cell body at one end, myelin segments with gaps (nodes), terminals at the other. The signal should be a gentle warm light, not lightning or neon. Visible suspension cables are fine and honest."
      },
      {
        view: "Visitor at the control plinth",
        prompt: "Wide 16:9 photograph, 35 mm lens at 1.5 m height, in a dim converted brick warehouse gallery. In the foreground, an adult in three-quarter view from behind hovers an open hand above the proximity sensor of a waist-height matte charcoal plinth that also carries a large, raised tactile button; a child beside them looks up. Above, the suspended neuron sculpture's cell body and first myelinated axon segments catch a warm travelling pulse of amber light as it starts its journey across the room. On the wall behind, a simplifications panel shows soft, illegible blocks of type beside a small diagram. Warm, low light and shallow depth of field.",
        notes: "Check the hand is natural and the button looks large and easy to find by touch. The panel must contain no readable fake text; the real simplifications list lives on the site."
      },
      {
        view: "Close-up along the axon",
        prompt: "Close-up 16:9 photograph, 50 mm lens looking slightly upwards from 1.6 m eye level, along a section of a suspended neuron sculpture in a converted brick warehouse. Pale, satin myelin sheath segments, each about 1 m long, wrap the axon and are separated by narrow exposed nodes; the soft warm amber light of the travelling signal sits at one node, about to jump to the next. The sculpture's surface has a subtle, organic membrane texture rather than a plastic sheen. Behind it, out of focus, the wall projection shows a magnified lipid membrane with schematic channel proteins. Timber trusses and fine steel suspension cables are visible above. Precise and calm.",
        notes: "Myelin should look like wrapped segments with clear gaps at the nodes. The signal light should stay warm and soft, and the membrane projection should look schematic but tidy."
      }
    ],

    /* ------------------------------------------------------------------ */
    vr: [
      {
        view: "Entrance view",
        prompt: "Wide 21:9 photograph, 24 mm lens at 1.6 m eye level, of a calm VR and discovery studio in a converted red-brick warehouse with exposed timber trusses, arched brick doorways and a polished concrete floor. Four visitors wear white standalone VR headsets with hand controllers: two seated on dark swivel chairs, two standing inside 2 m square zones marked by pale floor tape with clear margins between them. At the back centre, a 3 m wide screen shows the inside-the-body preview, a flythrough of a blood vessel with red blood cells drifting along a pink vessel wall. To the right, a staff member stands at a dark desk beside a tall charging cabinet. Warm, low lighting.",
        notes: "The large screen must show inside-the-body imagery (a blood vessel), not a starfield or galaxy as in the supplied render. Headsets should be generic white with no visible logos. Check the zones are clearly marked and spaced."
      },
      {
        view: "Visitor eye level: seated station and staff",
        prompt: "Wide 16:9 photograph, 35 mm lens at 1.5 m eye level, in a VR studio inside a converted brick warehouse. In the foreground, an older visitor sits on a dark swivel chair within a marked floor square, wearing a white standalone VR headset and holding controllers; a staff member in a plain dark top stands beside them, adjusting the head strap. Behind, an open lockable charging and hygiene cabinet holds rows of white headsets on shelves with neat cables and spare face covers. A large screen in soft focus shows a blood-vessel flythrough in muted reds. Warm spotlights on brick; a calm, supervised feel.",
        notes: "Check that headset fit and hands look natural. The scene should convey supervision and hygiene without looking clinical."
      },
      {
        view: "Touchscreen kiosks and quiet corner",
        prompt: "Wide 16:9 photograph, 35 mm lens at 1.6 m eye level, of the discovery side of a VR studio in a converted brick warehouse with timber trusses. In the foreground, two touchscreen anatomy kiosks, one set at seated height, each showing a realistic 3D model of the heart and torso on a dark background with minimal controls; a wheelchair user and a teenager explore them, seen in three-quarter view from behind. Beyond, through an arched brick opening, a quiet reflection corner with soft upholstered armchairs, acoustic felt panels and a single low warm lamp, where one visitor sits with eyes closed. Gentle, low lighting and shallow depth of field.",
        notes: "Kiosk screens should show clean anatomy, not generic sci-fi interfaces or holograms, and no readable text. The quiet corner should look genuinely calm and separate."
      }
    ]
  }
};
