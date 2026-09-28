/* The Universe Within — concept renders shown in the walkthrough's "Concept render" view,
   the room plans and the exported plan. Pure data. Australian spelling.
   These are AI-generated images the client supplied, cleaned of the web page's overlay text
   and buttons (the areas under those overlays are filled in, not original detail). They are
   mood and design references, not construction drawings, and `reviewNotes` records where they
   depart from anatomy or the brief. `w`/`h` are the pixel size of the full-size file; `srcSmall`
   is a 960-pixel-wide copy. Hotspot `x`/`y` are fractions of the image width and height,
   measured from the top-left corner; `el` is an installation id from js/model.js. A hotspot
   marks where that installation sits, or would sit, in the render. It does not mean the render
   shows it as briefed; the review notes say where it does not. */
window.UW_RENDERS = [
  {
    id: 'mouth-walkthrough',
    room: 'mouth',
    src: 'assets/renders/mouth-walkthrough.jpg',
    srcSmall: 'assets/renders/mouth-walkthrough-960.jpg',
    w: 1916, h: 1100,
    title: 'Walking into the mouth',
    caption: 'Visitors walk along a raised walkway with handrails, between giant upper and lower teeth, into a glossy pink tunnel. Water-like imagery is projected on the brick wall at far left.',
    credit: 'AI-generated concept render supplied by you',
    hotspots: [
      { el: 'mouth_teeth', x: 0.397, y: 0.064 },
      { el: 'mouth_palate', x: 0.459, y: 0.273 },
      { el: 'mouth_tongue', x: 0.59, y: 0.873 }
    ],
    reviewNotes: [
      'The teeth are stylised sculpture, not an anatomical model: the upper incisors are oversized, the canines are not distinct and the rows run into near-identical crowns. Check them against adult dentition before using this as a fabrication reference.',
      'Past the lips it becomes a long arched corridor: the walkway stands in for the tongue, and there is no soft palate, uvula, throat (pharynx) or epiglottis. The route from the mouth to the oesophagus needs its own treatment.',
      'The saliva and swallow projections and the water-or-sugary-drink selector are not shown. The only projection is on the brick wall outside the mouth, and projecting onto a glossy canopy under overhanging teeth would cause glare and shadows.',
      'Step-free access is not shown: the walkway undulates, the handrails have gaps and the wet-look finish raises slip-resistance questions. Nothing here shows that capacity, access or safety have been checked.',
      'The overhead teeth would need concealed structure, and the resin surfaces and hanging “saliva” strands invite touching, so they need durable, cleanable, fire-rated materials.'
    ]
  },
  {
    id: 'digestive-hall',
    room: 'digestive',
    src: 'assets/renders/digestive-hall.jpg',
    srcSmall: 'assets/renders/digestive-hall-960.jpg',
    w: 2000, h: 719,
    title: 'Inside the digestive hall',
    caption: 'A brick hall with a ribbed walk-through tunnel on the left, a giant stomach sculpture in the centre and projections of gut tissue on the walls. The visitors give a sense of scale.',
    credit: 'AI-generated concept render supplied by you',
    hotspots: [
      { el: 'dig_oesophagus', x: 0.13, y: 0.4 },
      { el: 'dig_proj_peristalsis', x: 0.355, y: 0.44 },
      { el: 'dig_stomach', x: 0.55, y: 0.5 },
      { el: 'dig_proj_stomach', x: 0.8, y: 0.5 },
      { el: 'dig_microbiome', x: 0.895, y: 0.18 },
      { el: 'dig_stepfree', x: 0.72, y: 0.94 }
    ],
    reviewNotes: [
      'The tunnel’s circular rings read more like a windpipe (trachea) than an oesophagus, whose lining folds run lengthways. Swallowing could be shown as projected rings of contraction travelling along it.',
      'The stomach sculpture is simplified: the outlet and duodenum are exaggerated into a floor-to-ceiling arch, and it is unclear where the oesophagus joins it. The inner folds (rugae) appear only in the wall projection.',
      'The projections show generic glowing tissue; none is recognisably peristalsis, stomach acid or gut microbes. Most gut microbes live in the large intestine, so microbiome content belongs after the stomach and needs expert review.',
      'The sculpture would need structural engineering and rigging, and it stands between the projectors and the walls, so expect shadows unless short-throw, rear or overhead projection is planned.',
      'The tunnel shows no handrails, exit lighting or wayfinding, and the open, level route around it is only suggested. Nothing here shows that capacity, access or safety have been checked.'
    ]
  },
  {
    id: 'vr-studio',
    room: 'vr',
    src: 'assets/renders/vr-studio.jpg',
    srcSmall: 'assets/renders/vr-studio-960.jpg',
    w: 2000, h: 641,
    title: 'The VR and Discovery Studio',
    caption: 'A calm brick-warehouse studio where visitors try VR standing in taped floor zones or seated on low poufs, others watch a large screen from a bench, and a staff member supervises from a desk.',
    credit: 'AI-generated concept render supplied by you',
    hotspots: [
      { el: 'vr_seated', x: 0.245, y: 0.686 },
      { el: 'vr_bigscreen', x: 0.335, y: 0.434 },
      { el: 'vr_standing', x: 0.396, y: 0.523 },
      { el: 'vr_staff', x: 0.8625, y: 0.671 }
    ],
    reviewNotes: [
      'The large screen shows a starfield. In the brief it previews the inside-the-body journeys, such as a flight through a blood vessel.',
      'The brief specifies swivel chairs, but the render shows low backless poufs, which are hard to get up from while wearing a headset. No wheelchair-accessible seated station is shown.',
      'Only some users are in marked zones, and raised controllers come close to walkways and to each other. Clear zones and supervision need to be set in the room plan; this image does not show a safe capacity.',
      'The screen partition blocks the staff desk’s view of the left-hand stations. The render does not show the charging and hygiene cabinet, the touchscreen anatomy explorer or the quiet area; the tall cabinet at right is a likely place for the charging cabinet.',
      'Low, warm lighting and a glossy floor may affect headset tracking, so test them with the chosen headsets. Headsets and furniture are illustrative; no supplier or product is implied.'
    ]
  }
];
