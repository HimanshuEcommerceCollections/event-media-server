/**
 * The service catalogue and everything the six service pages render.
 *
 * Prices are integer cents and match the figures the pages were built with, so
 * seeding reproduces the current pages exactly.
 *
 * `blocks` is a list per kind. The kinds a page reads are its own business;
 * the API groups them by kind and hands the payloads over untouched. `pricing`
 * is singular — one calculator per page — and its `model` field says which
 * calculator shape to expect:
 *   items      — a quantity per row (party rentals)
 *   performers — base + hourly per act (entertainers)
 *   hourly     — one hourly rate plus add-ons (DJ + music)
 *   packs      — pick one package plus add-ons (photo, tours, drone)
 *
 * `iconKey` on a step names a shape in the frontend's icon registry; the SVG
 * paths stay in the view, since markup is not content.
 */

export type SeedBlock = { kind: string; payload: Record<string, unknown> };

export type SeedService = {
  slug: string;
  no: string;
  title: string;
  blurb: string;
  priceLabel: string;
  priceCents: number | null;
  priceUnit: string | null;
  isB2b: boolean;
  imagePath: string;
  imageAlt: string;
  iconKey: string;
  hero: Record<string, unknown>;
  blocks: SeedBlock[];
  /** Photo strips and polaroid walls, stored on surface `service:<slug>`. */
  gallery: { imagePath: string; label: string; caption?: string }[];
};

const intro = (items: { name: string; text: string }[]): SeedBlock[] =>
  items.map((payload) => ({ kind: "intro", payload }));

const faqs = (items: { question: string; answer: string }[]): SeedBlock[] =>
  items.map((payload) => ({ kind: "faq", payload }));

const included = (items: string[]): SeedBlock[] =>
  items.map((text) => ({ kind: "included", payload: { text } }));

const steps = (items: { no: string; heading: string; text: string; iconKey: string }[]): SeedBlock[] =>
  items.map((payload) => ({ kind: "step", payload }));

/* ------------------------------------------------------------ party rentals */

const partyRentals: SeedService = {
  slug: "party-rentals",
  no: "01",
  title: "Party rentals",
  blurb: "Chairs, tables, tents — partner-fulfilled.",
  priceLabel: "from $1.75 / chair",
  priceCents: 175,
  priceUnit: "chair",
  isB2b: false,
  imagePath: "/assets/svc-01-party-rentals.jpg",
  imageAlt: "Decorated event venue",
  iconKey: "tent",
  hero: {
    kicker: "Service 01",
    heading: "Party rentals",
    lede: "Chairs, tables, tents and the trimmings — delivered, staged and collected.",
  },
  blocks: [
    ...intro([
      { name: "Delivered & set up", text: "We handle drop-off, staging and collection." },
      { name: "Partner-fulfilled", text: "Vetted local inventory, not warehoused by us." },
      { name: "Priced per item", text: "See the per-piece cost before you commit." },
    ]),
    {
      kind: "pricing",
      payload: {
        model: "items",
        items: [
          { key: "chair", label: "Folding chair", note: "$1.75 each · steps of 10", unitCents: 175, step: 10 },
          { key: "table", label: "Round table", note: "$9.50 each", unitCents: 950, step: 1 },
          { key: "linen", label: "Table linen", note: "$6.25 each", unitCents: 625, step: 1 },
          { key: "tent", label: "20×20 tent", note: "$325.00 each", unitCents: 32500, step: 1 },
          { key: "dancefloor", label: "Dance floor", note: "$210.00 each", unitCents: 21000, step: 1 },
          { key: "lighting", label: "String-light kit", note: "$145.00 each", unitCents: 14500, step: 1 },
        ],
        startQuantities: { chair: 40, table: 5, linen: 5, tent: 0, dancefloor: 0, lighting: 0 },
        // The chair strip stops drawing past this and prints the remainder.
        chairVizMax: 80,
      },
    },
    {
      kind: "kit",
      payload: {
        key: "backyard",
        name: "Backyard Party",
        imageFile: "kit-backyard-party.jpg",
        includes: ["30 folding chairs", "4 round tables", "4 table linens", "String-light kit"],
        quantities: { chair: 30, table: 4, linen: 4, tent: 0, dancefloor: 0, lighting: 1 },
      },
    },
    {
      kind: "kit",
      payload: {
        key: "wedding",
        name: "The Wedding",
        imageFile: "kit-wedding.jpg",
        includes: [
          "120 folding chairs",
          "15 round tables",
          "15 table linens",
          "20×20 tent",
          "Dance floor",
          "2 string-light kits",
        ],
        quantities: { chair: 120, table: 15, linen: 15, tent: 1, dancefloor: 1, lighting: 2 },
      },
    },
    {
      kind: "kit",
      payload: {
        key: "birthday",
        name: "Kids' Birthday",
        imageFile: "kit-kids-birthday.jpg",
        includes: ["20 folding chairs", "3 round tables", "3 table linens", "String-light kit"],
        quantities: { chair: 20, table: 3, linen: 3, tent: 0, dancefloor: 0, lighting: 1 },
      },
    },
    ...steps([
      { no: "01", heading: "Deliver", text: "We drop everything at your venue, on schedule.", iconKey: "truck" },
      { no: "02", heading: "Set up", text: "Our partners stage chairs, tables and decor.", iconKey: "gear" },
      { no: "03", heading: "Celebrate", text: "You enjoy the day — nothing to haul or fuss.", iconKey: "brush" },
      { no: "04", heading: "Collect", text: "We pack it all down and take it away after.", iconKey: "box" },
    ]),
    // Position and rotation belong to the scattered polaroid wall, so they
    // travel with the item rather than being re-derived in the view.
    {
      kind: "polaroid",
      payload: { imageFile: "ba-styled.jpg", label: "Setup", left: "2%", top: "6%", rotate: "-6deg" },
    },
    {
      kind: "polaroid",
      payload: { imageFile: "polaroid-moment.jpg", label: "The moment", left: "23%", top: "30%", rotate: "4deg" },
    },
    {
      kind: "polaroid",
      payload: { imageFile: "polaroid-head-table.jpg", label: "Head table", left: "45%", top: "3%", rotate: "-3deg" },
    },
    {
      kind: "polaroid",
      payload: { imageFile: "polaroid-little-guests.jpg", label: "Little guests", left: "60%", top: "34%", rotate: "7deg" },
    },
    {
      kind: "polaroid",
      payload: { imageFile: "polaroid-first-dance.jpg", label: "First dance", left: "78%", top: "12%", rotate: "-5deg" },
    },
    ...faqs([
      {
        question: "Do you deliver and set up?",
        answer:
          "Yes — delivery, setup and pickup are coordinated with the fulfilling partner and included in your request.",
      },
      {
        question: "Is there a minimum order?",
        answer: "Most partners have a small minimum; the builder will flag it before you submit.",
      },
      {
        question: "How far ahead should I book?",
        answer: "Two to three weeks is ideal for peak-season weekends.",
      },
    ]),
  ],
  gallery: [],
};

/* -------------------------------------------------------------- entertainers */

const entertainers: SeedService = {
  slug: "entertainers",
  no: "02",
  title: "Entertainers",
  blurb: "Magicians, face painters and more, by the hour.",
  priceLabel: "from $160",
  priceCents: 16000,
  priceUnit: null,
  isB2b: false,
  imagePath: "/assets/svc-02-entertainers.jpg",
  imageAlt: "Face-painting entertainer",
  iconKey: "star",
  hero: {
    kicker: "Service 02",
    heading: "Entertainers",
    lede: "Vetted local acts for every age, booked by the hour.",
  },
  blocks: [
    ...intro([
      { name: "Vetted performers", text: "Background-checked, reviewed local talent." },
      { name: "Booked by the hour", text: "1–6 hours, base plus an hourly rate." },
      { name: "Kids & adults", text: "From birthday face-painting to gala magic." },
    ]),
    {
      kind: "pricing",
      payload: {
        model: "performers",
        minHours: 1,
        maxHours: 6,
        performers: [
          { key: "magician", name: "Magician", fromLabel: "from $350", imageFile: "hero-poster.jpg", baseCents: 35000, hourlyCents: 9000 },
          { key: "face-painter", name: "Face painter", fromLabel: "from $180", imageFile: "perf-1.jpg", baseCents: 18000, hourlyCents: 7000 },
          { key: "caricaturist", name: "Caricaturist", fromLabel: "from $220", imageFile: "perf-2.jpg", baseCents: 22000, hourlyCents: 8000 },
          { key: "balloon-artist", name: "Balloon artist", fromLabel: "from $160", imageFile: "perf-3.jpg", baseCents: 16000, hourlyCents: 6500 },
        ],
      },
    },
    ...["Magic", "Face paint", "Caricatures", "Balloons", "Comedy"].map((label) => ({
      kind: "marquee",
      payload: { label },
    })),
    // The fanned deck of quote cards. `left`, `rotate` and `suit` are the card's
    // place in the fan, which is content here rather than layout: the order and
    // the spread are authored, not computed.
    {
      kind: "card",
      payload: { left: "16%", rotate: "-26deg", suit: "♠", tone: "dark", quote: "Our magician had grown adults gasping like kids.", author: "The Reeves wedding" },
    },
    {
      kind: "card",
      payload: { left: "30%", rotate: "-15deg", suit: "♥", tone: "red", quote: "Sixty happy painted faces in two hours flat.", author: "Maple St birthday" },
    },
    {
      kind: "card",
      payload: { left: "43%", rotate: "-5deg", suit: "♦", tone: "red", quote: "Balloon swords: the undefeated crowd-pleaser.", author: "Backyard bash" },
    },
    {
      kind: "card",
      payload: { left: "57%", rotate: "5deg", suit: "♣", tone: "dark", quote: "The caricatures became everyone's favourite keepsake.", author: "Corporate mixer" },
    },
    {
      kind: "card",
      payload: { left: "70%", rotate: "15deg", suit: "★", tone: "acc", quote: "One form, one show-stopper. That easy.", author: "Downtown gala" },
    },
    {
      kind: "card",
      payload: { left: "84%", rotate: "26deg", suit: "♠", tone: "dark", quote: "Booked, matched and delighted in minutes.", author: "Elm St party" },
    },
    ...steps([
      { no: "01", heading: "Book", text: "Pick a performer and hours, send one request.", iconKey: "book" },
      { no: "02", heading: "Matched", text: "We pair you with a vetted local act.", iconKey: "users" },
      { no: "03", heading: "They arrive", text: "Everything they need, set up and ready.", iconKey: "truck" },
      { no: "04", heading: "Showtime", text: "The room lights up — you just enjoy it.", iconKey: "star" },
    ]),
    ...faqs([
      {
        question: "Can I book more than one performer?",
        answer: "Absolutely — add several to a single event request and see the combined total.",
      },
      {
        question: "Do performers bring their own supplies?",
        answer: "Yes, all materials and setup are included in the quoted rate.",
      },
      {
        question: "What ages are the acts suitable for?",
        answer: "Each listing notes its best-fit audience; most suit all ages.",
      },
    ]),
  ],
  gallery: [],
};

/* ----------------------------------------------------------------- dj + music */

const djMusic: SeedService = {
  slug: "dj-music",
  no: "03",
  title: "DJ + music",
  blurb: "By the hour with uplighting and booth add-ons.",
  priceLabel: "$125 / hr",
  priceCents: 12500,
  priceUnit: "hour",
  isB2b: false,
  imagePath: "/assets/svc-03-dj-music.jpg",
  imageAlt: "DJ at a party",
  iconKey: "disc",
  hero: {
    kicker: "Service 03",
    heading: "DJ + music",
    lede: "Pro local DJs by the hour, with the add-ons that make a room move.",
  },
  blocks: [
    ...intro([
      { name: "Pro local DJs", text: "Reviewed, reliable, genre-flexible." },
      { name: "By the hour", text: "2–8 hour sets to match your timeline." },
      { name: "Full add-ons", text: "Uplighting, fog, MC and photo booth." },
    ]),
    {
      kind: "pricing",
      payload: {
        model: "hourly",
        hourlyCents: 12500,
        minHours: 2,
        maxHours: 8,
        addons: [
          { key: "uplighting", name: "Uplighting", cents: 9500, label: "+$95" },
          { key: "fog", name: "Fog machine", cents: 4500, label: "+$45" },
          { key: "mc", name: "MC services", cents: 11000, label: "+$110" },
          { key: "booth", name: "Photo booth", cents: 25000, label: "+$250" },
        ],
      },
    },
    ...faqs([
      {
        question: "Can the DJ MC the event too?",
        answer: "Yes — add MC services and your DJ handles announcements and the run of show.",
      },
      {
        question: "Do you provide the sound system?",
        answer: "A full PA suited to your headcount and venue is included.",
      },
      {
        question: "Can we send a playlist?",
        answer: "Of course — share must-plays and do-not-plays in your request notes.",
      },
    ]),
  ],
  gallery: [],
};

/* --------------------------------------------------------------- photo + video */

const photoVideo: SeedService = {
  slug: "photo-video",
  no: "04",
  title: "Photo + video",
  blurb: "From a two-hour session to a cinematic package.",
  priceLabel: "from $395",
  priceCents: 39500,
  priceUnit: null,
  isB2b: false,
  imagePath: "/assets/svc-04-photo-video.jpg",
  imageAlt: "Videographer recording",
  iconKey: "camera",
  hero: {
    kicker: "Service 04",
    heading: "Photo + video",
    lede: "Fixed packages, clear pricing, edited gallery in five business days.",
  },
  blocks: [
    ...intro([
      { name: "Fixed packages", text: "Clear pricing, no hourly surprises." },
      { name: "Photo & video", text: "Stills, film, or both in one booking." },
      { name: "Fast turnaround", text: "Edited gallery within five business days." },
    ]),
    {
      kind: "pricing",
      payload: {
        model: "packs",
        packs: [
          { key: "photo-2", name: "Photo · 2 hrs", cents: 39500 },
          { key: "photo-4", name: "Photo · 4 hrs", cents: 69500 },
          { key: "photo-video", name: "Photo + video", cents: 125000 },
          { key: "cinematic", name: "Cinematic package", cents: 210000 },
        ],
        addons: [
          { key: "second-shooter", name: "Second shooter", cents: 30000 },
          { key: "drone", name: "Drone footage", cents: 25000 },
          { key: "teaser", name: "Same-day teaser", cents: 18000 },
          { key: "prints", name: "Prints + album", cents: 22000 },
        ],
      },
    },
    ...included([
      "Edited online gallery",
      "Print & share release",
      "Backup shooter on standby",
      "Delivered in 5 business days",
    ]),
    // The EXIF row the gallery HUD paints over each frame.
    {
      kind: "frame",
      payload: {
        imageFile: "gallery-1.jpg",
        caption: "On set · the shoot",
        exif: { lens: "35mm", aperture: "f/1.8", shutter: "1/160", iso: "400", whiteBalance: "5600K" },
      },
    },
    {
      kind: "frame",
      payload: {
        imageFile: "gallery-2.jpg",
        caption: "Sparkler · golden hour",
        exif: { lens: "50mm", aperture: "f/2.0", shutter: "1/125", iso: "800", whiteBalance: "3200K" },
      },
    },
    {
      kind: "frame",
      payload: {
        imageFile: "gallery-3.jpg",
        caption: "Confetti · costume party",
        exif: { lens: "24mm", aperture: "f/2.8", shutter: "1/250", iso: "640", whiteBalance: "5200K" },
      },
    },
    {
      kind: "frame",
      payload: {
        imageFile: "gallery-4.jpg",
        caption: "Lifestyle · candid",
        exif: { lens: "85mm", aperture: "f/1.4", shutter: "1/320", iso: "200", whiteBalance: "5000K" },
      },
    },
    {
      kind: "frame",
      payload: {
        imageFile: "gallery-5.jpg",
        caption: "Nightlife · the after-party",
        exif: { lens: "35mm", aperture: "f/1.6", shutter: "1/100", iso: "1600", whiteBalance: "3000K" },
      },
    },
    ...faqs([
      {
        question: "How long until we get our photos?",
        answer: "Edited galleries are delivered within five business days; sneak peeks sooner.",
      },
      {
        question: "Do we get the raw files?",
        answer: "Final edited images are yours to keep and share; raws stay with the shooter.",
      },
      {
        question: "Can we add a second shooter?",
        answer: "Yes — note it in your request and we’ll price it in.",
      },
    ]),
  ],
  gallery: [],
};

/* -------------------------------------------------------------- virtual tours */

const virtualTours: SeedService = {
  slug: "virtual-tours",
  no: "05",
  title: "Virtual tours",
  blurb: "3D walkthroughs for realtors, by square footage.",
  priceLabel: "from $199",
  priceCents: 19900,
  priceUnit: null,
  isB2b: true,
  imagePath: "/assets/svc-05-virtual-tours.jpg",
  imageAlt: "Virtual tour with VR",
  iconKey: "house",
  hero: {
    kicker: "Service 05",
    heading: "Virtual tours",
    lede: "3D walkthroughs priced by square footage, hosted and delivered next day.",
  },
  blocks: [
    ...intro([
      { name: "For realtors", text: "Volume-friendly for repeat listings." },
      { name: "Priced by sq ft", text: "Straightforward tiers, no guesswork." },
      { name: "Fast delivery", text: "Hosted tour link back the next day." },
    ]),
    {
      kind: "pricing",
      payload: {
        model: "packs",
        packs: [
          { key: "under-1500", name: "Under 1,500 sq ft", cents: 19900 },
          { key: "1500-3000", name: "1,500–3,000", cents: 29900 },
          { key: "3000-5000", name: "3,000–5,000", cents: 44900 },
          { key: "over-5000", name: "5,000+ sq ft", cents: 64900 },
        ],
        addons: [
          { key: "floor-plan", name: "2D floor plan", cents: 7900 },
          { key: "aerial", name: "Aerial exterior", cents: 14900 },
          { key: "dollhouse", name: "Dollhouse 3D view", cents: 9900 },
          { key: "hosting", name: "12-mo hosting", cents: 6000 },
        ],
      },
    },
    ...included([
      "Hosted, shareable tour link",
      "Unlimited walk-through views",
      "Mobile & VR ready",
      "Delivered next business day",
    ]),
    ...faqs([
      {
        question: "How is the tour delivered?",
        answer: "As a hosted link you can embed on your listing and MLS.",
      },
      {
        question: "Do you offer volume rates?",
        answer: "Yes — recurring-shoot volume routes to a coordinator for a custom rate.",
      },
      {
        question: "How large a property can you scan?",
        answer: "Any size; tiers scale to 5,000+ sq ft with custom pricing above.",
      },
    ]),
  ],
  gallery: [],
};

/* ---------------------------------------------------------------- drone video */

const droneVideo: SeedService = {
  slug: "drone-video",
  no: "06",
  title: "Drone video",
  blurb: "Aerial footage as an add-on or standalone flight.",
  priceLabel: "from $175",
  priceCents: 17500,
  priceUnit: null,
  isB2b: true,
  imagePath: "/assets/svc-06-drone-video.jpg",
  imageAlt: "Drone operator",
  iconKey: "drone",
  hero: {
    kicker: "Service 06",
    heading: "Drone video",
    lede: "Insured pilots, 4K aerials — as an add-on or a flight of its own.",
  },
  blocks: [
    ...intro([
      { name: "Insured pilots", text: "Flown by insured local operators." },
      { name: "Add-on or standalone", text: "Pair with a shoot or book alone." },
      { name: "4K + stills", text: "Aerial video and photos, edited on request." },
    ]),
    {
      kind: "pricing",
      payload: {
        model: "packs",
        packs: [
          { key: "addon", name: "Add-on to a shoot", cents: 17500 },
          { key: "standalone", name: "Standalone flight", cents: 45000 },
        ],
        addons: [
          { key: "highlight-reel", name: "Edited highlight reel", cents: 15000 },
          { key: "extra-location", name: "Extra location", cents: 12000 },
          { key: "twilight", name: "Twilight flight", cents: 9000 },
          { key: "raw-4k", name: "Raw 4K files", cents: 6000 },
        ],
      },
    },
    ...included([
      "FAA-licensed, insured pilot",
      "4K aerial video + stills",
      "Pre-flight site & airspace check",
      "Edited reel on request",
    ]),
    ...faqs([
      {
        question: "Are your pilots insured?",
        answer:
          "Yes — every flight is flown by an insured local pilot who handles airspace rules.",
      },
      {
        question: "Can drone pair with a listing tour?",
        answer: "Absolutely — add it to a virtual-tour request for a full media package.",
      },
      {
        question: "What do we receive?",
        answer: "4K aerial video and stills; add an edited highlight reel if you’d like.",
      },
    ]),
  ],
  gallery: [],
};

export const SERVICES: readonly SeedService[] = [
  partyRentals,
  entertainers,
  djMusic,
  photoVideo,
  virtualTours,
  droneVideo,
];
