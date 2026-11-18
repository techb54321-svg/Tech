/* Static lists and demo data for Quiet Table. */
window.QT_DATA = {
  // Food types. `match` is a regular expression for the OpenStreetMap "cuisine" tag.
  // `amenity` limits the search to cafés etc. `diet` searches the diet:* tags instead.
  cuisines: [
    { id: "any", label: "Any kind of food" },
    { id: "british", label: "British / traditional", match: "british|english|irish|scottish|regional|traditional" },
    { id: "american", label: "American / burgers / grill", match: "american|burger|grill|diner|barbecue|bbq" },
    { id: "italian", label: "Italian / pizza", match: "italian|pizza|pasta" },
    { id: "french", label: "French", match: "french|bistro|brasserie" },
    { id: "mediterranean", label: "Greek / Mediterranean", match: "greek|mediterranean|turkish|lebanese|middle_eastern|spanish|tapas|portuguese" },
    { id: "chinese", label: "Chinese", match: "chinese|cantonese|dim_sum|szechuan|sichuan" },
    { id: "indian", label: "Indian", match: "indian|curry|pakistani|bangladeshi|nepalese|sri_lankan" },
    { id: "japanese", label: "Japanese / sushi", match: "japanese|sushi|ramen" },
    { id: "thai", label: "Thai / Vietnamese / Asian", match: "thai|vietnamese|asian|malaysian|indonesian|korean" },
    { id: "mexican", label: "Mexican / Latin", match: "mexican|tex-mex|latin_american|peruvian|brazilian|argentinian" },
    { id: "seafood", label: "Fish & seafood", match: "seafood|fish|fish_and_chips|oyster" },
    { id: "steak", label: "Steakhouse", match: "steak_house|steak|steakhouse" },
    { id: "vegetarian", label: "Vegetarian / vegan", match: "vegetarian|vegan", diet: true },
    { id: "cafe", label: "Café / tea room / brunch", amenity: "cafe" },
  ],

  // Things diners can tick when rating. `good: true` means it helps conversation.
  features: [
    { id: "booths", label: "Booths or quiet corners", good: true },
    { id: "soft", label: "Carpets, curtains or soft furnishings", good: true },
    { id: "cloths", label: "Tablecloths", good: true },
    { id: "spaced", label: "Tables well spaced", good: true },
    { id: "staff", label: "Staff happy to seat us somewhere quieter", good: true },
    { id: "echo", label: "Hard floors / high ceilings – echoey", good: false },
    { id: "kitchen", label: "Noisy open kitchen", good: false },
    { id: "tv", label: "TVs or sport on", good: false },
    { id: "crowd", label: "Large groups or parties", good: false },
  ],

  // Fictional restaurants for ?demo mode. dx/dy are offsets in km from the chosen location.
  demo: [
    { name: "The Linen Room", cuisine: "french", dx: 0.4, dy: 0.3, phone: "+44 1234 567801", addr: "12 Mill Lane", hours: "Tu-Sa 12:00-14:30, 18:00-22:00", wheelchair: "yes",
      ratings: [[4, "soft", 58, ["cloths", "soft", "spaced"], 3], [4, "none", null, ["booths", "cloths"], 3], [3, "soft", 63, [], 3]] },
    { name: "Nonna's Kitchen", cuisine: "italian;pizza", dx: -0.6, dy: 0.9, phone: "+44 1234 567802", addr: "4 Market Square", hours: "Mo-Su 11:30-22:30",
      ratings: [[2, "loud", 76, ["echo", "kitchen"], 2], [2, "soft", null, ["crowd"], 2], [3, "soft", 71, [], 2]] },
    { name: "Willow Tea Rooms", amenity: "cafe", cuisine: "tea;cake", dx: 1.2, dy: -0.4, addr: "33 High Street", hours: "Mo-Sa 09:00-17:00", wheelchair: "limited",
      ratings: [[4, "none", 55, ["soft", "spaced"], 1], [4, "soft", null, ["staff"], 1]] },
    { name: "Golden Lotus", cuisine: "chinese", dx: -1.8, dy: -1.1, phone: "+44 1234 567804", addr: "88 Station Road", hours: "Mo-Su 17:00-23:00", wheelchair: "yes",
      ratings: [[3, "soft", 68, ["booths"], 2], [4, "soft", null, ["booths", "spaced"], 2]] },
    { name: "The Anchor Grill", cuisine: "steak_house;grill", dx: 2.6, dy: 1.9, phone: "+44 1234 567805", addr: "1 Quay Street", liveMusic: true,
      ratings: [[1, "loud", 82, ["tv", "crowd", "echo"], 3], [2, "loud", null, ["tv"], 3]] },
    { name: "Spice Garden", cuisine: "indian", dx: 3.4, dy: -2.2, phone: "+44 1234 567806", addr: "21 Church Street", hours: "Mo-Su 17:30-23:00",
      ratings: [[3, "soft", null, ["soft"], 2]] },
    { name: "Harbour Fish Bar", cuisine: "fish_and_chips;seafood", dx: -3.9, dy: 2.5, addr: "7 The Front" },
    { name: "Olive & Vine", cuisine: "greek;mediterranean", dx: 4.1, dy: 3.2, phone: "+44 1234 567808", addr: "56 Park Road", wheelchair: "yes",
      ratings: [[4, "soft", 62, ["spaced", "cloths"], 3], [3, "soft", null, ["staff"], 3], [4, "none", null, [], 3]] },
    { name: "Sakura", cuisine: "japanese;sushi", dx: -0.9, dy: -0.5, phone: "+44 1234 567809", addr: "3 Bridge Street",
      ratings: [[3, "soft", 67, [], 3]] },
    { name: "Green Leaf", cuisine: "vegetarian", dx: 6.5, dy: -4.0, addr: "14 Garden Row" },
    { name: "The Shire Bistro", cuisine: "british", dx: 7.8, dy: 5.4, phone: "+44 1234 567811", addr: "Old Rectory, Long Lane", hours: "We-Su 12:00-15:00, 18:00-21:30", wheelchair: "yes",
      ratings: [[4, "none", 57, ["soft", "booths", "spaced"], 2], [4, "soft", null, ["cloths"], 2]] },
    { name: "Taco Loco", cuisine: "mexican", dx: 0.2, dy: -1.5, addr: "9 Union Street", liveMusic: true,
      ratings: [[1, "loud", 84, ["echo", "crowd"], 1]] },
  ],
};
