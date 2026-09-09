/**
 * The narrative pages: how it works, about, the FAQ, the commercial register,
 * the pricing preamble and the builder copy.
 *
 * A section is `{ kind, payload }` in document order, the same convention the
 * legal documents use. The kind names a shape the page knows how to render;
 * the API hands the payload over untouched.
 *
 * Prices are never restated here. `/pricing` renders its figures from the
 * pricing document, which is generated from the service catalogue — a number
 * typed into this file would be the one that goes stale.
 */

export type SeedSection = { kind: string; payload: Record<string, unknown> };

export type SeedPage = {
  slug: string;
  title: string;
  kicker: string;
  summary: string;
  hero: Record<string, unknown>;
  sections: SeedSection[];
};

/* ------------------------------------------------------------ how it works */

const howItWorks: SeedPage = {
  slug: "how-it-works",
  title: "How it works",
  kicker: "One request",
  summary: "Describe the event once, tick what it needs, send one request.",
  hero: {
    heading: "One request. Whole event covered.",
    lede: "No calling six vendors and reconciling six quotes. Build the package, watch the total, send it once.",
    ctaHref: "/build",
    ctaLabel: "Build my event",
  },
  sections: [
    {
      kind: "steps",
      payload: {
        heading: "Four steps, about five minutes",
        steps: [
          {
            no: "01",
            heading: "Describe the day",
            text: "Type of event, the date, roughly how many people and where. That is the whole intake.",
            iconKey: "calendar",
          },
          {
            no: "02",
            heading: "Tick what it needs",
            text: "Six services, each with its own configurator. Ticking one opens it; the running total moves as you go.",
            iconKey: "check",
          },
          {
            no: "03",
            heading: "Check the receipt",
            text: "Every line itemised, every line editable. The estimated package total sits at the bottom.",
            iconKey: "receipt",
          },
          {
            no: "04",
            heading: "Send it once",
            text: "One request, one reference number, one coordinator. We come back inside one business day.",
            iconKey: "send",
          },
        ],
      },
    },
    {
      kind: "note",
      payload: {
        heading: "Why the total is an estimate",
        text: "The figures are real catalogue prices, so the arithmetic is exact. What can still move is the event: weddings and anything over 100 guests are quoted by a coordinator, because the staffing and the timings stop being standard.",
      },
    },
    {
      kind: "faq",
      payload: {
        question: "Do I have to book everything at once?",
        answer: "No. One service is a perfectly good request — the builder just makes it easy to add a second.",
      },
    },
    {
      kind: "faq",
      payload: {
        question: "Is the total binding?",
        answer: "It is an estimate built from catalogue pricing. A coordinator confirms it before anything is booked.",
      },
    },
    {
      kind: "faq",
      payload: {
        question: "What happens after I send it?",
        answer: "You get a reference like EVM-2026-0001 and a reply inside one business day.",
      },
    },
  ],
};

/* -------------------------------------------------------------------- about */

const about: SeedPage = {
  slug: "about",
  title: "About",
  kicker: "Raleigh",
  summary: "A Raleigh event marketplace built around the intake rather than the inventory.",
  hero: {
    heading: "Tell us about the day — we will bring the rest.",
    lede: "We coordinate the vendors Raleigh already has, and we own the part everyone finds tedious: working out what the whole thing costs.",
  },
  sections: [
    {
      kind: "prose",
      payload: {
        heading: "What we actually do",
        paragraphs: [
          "Planning an event locally means six conversations, six quotes on six different terms, and a spreadsheet you build yourself. We replaced that with one form.",
          "The vendors are local and vetted. The rentals are partner-fulfilled — we do not warehouse chairs, we coordinate the people who do. What we own is the coordination and the number at the bottom of the page.",
        ],
      },
    },
    {
      kind: "prose",
      payload: {
        heading: "Two rooms, one desk",
        paragraphs: [
          "A parent booking a face painter and a realtor booking a Monday-morning listing shoot want the same thing: a price, quickly, without a meeting. So the commercial media work sits on the same rails as the party work.",
        ],
      },
    },
    {
      kind: "values",
      payload: {
        heading: "How we work",
        values: [
          { label: "Priced up front", text: "Every service publishes its rates. Nothing is quoted only on request." },
          { label: "One point of contact", text: "One request, one coordinator, however many vendors it takes." },
          { label: "Local", text: "Raleigh and the surrounding towns. We know the venues." },
          { label: "Honest about limits", text: "Where a package needs customising, we say so before you send it." },
        ],
      },
    },
  ],
};

/* ---------------------------------------------------------------------- faq */

const faq: SeedPage = {
  slug: "faq",
  title: "Questions",
  kicker: "FAQ",
  summary: "Booking, pricing, coverage and what happens after you send a request.",
  hero: { heading: "Questions, answered", lede: "The things people ask before they send a request." },
  sections: [
    { kind: "group", payload: { key: "booking", label: "Booking" } },
    {
      kind: "faq",
      payload: {
        group: "booking",
        question: "How far ahead should I book?",
        answer: "Four to six weeks is comfortable for most events. Weddings and anything in peak season are better at three months. We will tell you if a date is tight.",
      },
    },
    {
      kind: "faq",
      payload: {
        group: "booking",
        question: "Can I change the package after sending it?",
        answer: "Yes. The request is the start of a conversation, not a contract — your coordinator adjusts it with you.",
      },
    },
    {
      kind: "faq",
      payload: {
        group: "booking",
        question: "Do you cover outside Raleigh?",
        answer: "The surrounding towns, yes. Send the ZIP with your request and we will confirm travel before quoting.",
      },
    },
    { kind: "group", payload: { key: "pricing", label: "Pricing" } },
    {
      kind: "faq",
      payload: {
        group: "pricing",
        question: "Is the running total the final price?",
        answer: "It is an exact sum of catalogue prices for what you ticked. It becomes a confirmed quote once a coordinator has looked at the date and the venue.",
      },
    },
    {
      kind: "faq",
      payload: {
        group: "pricing",
        question: "Why do weddings and large events get a caveat?",
        answer: "Above 100 guests, staffing, timings and load-in stop being standard. The catalogue still prices the parts; a coordinator prices the day.",
      },
    },
    {
      kind: "faq",
      payload: {
        group: "pricing",
        question: "Do you take a deposit through the site?",
        answer: "No. Nothing is paid here — the request is free and non-binding.",
      },
    },
    { kind: "group", payload: { key: "services", label: "Services" } },
    {
      kind: "faq",
      payload: {
        group: "services",
        question: "Do you own the rental inventory?",
        answer: "No. Party rentals are partner-fulfilled: vetted local suppliers hold the stock, we coordinate delivery, staging and collection.",
      },
    },
    {
      kind: "faq",
      payload: {
        group: "services",
        question: "Can I book a single service?",
        answer: "Yes. Every service page has a Book just this service link that opens the builder with that tile already ticked.",
      },
    },
    { kind: "group", payload: { key: "commercial", label: "Commercial" } },
    {
      kind: "faq",
      payload: {
        group: "commercial",
        question: "Do you work with realtors on repeat listings?",
        answer: "That is most of the commercial work. Recurring shoots route to a coordinator who sets a volume rate rather than pricing each listing.",
      },
    },
    {
      kind: "faq",
      payload: {
        group: "commercial",
        question: "How quickly do listing media come back?",
        answer: "Virtual tours are delivered the next business day; photography inside five.",
      },
    },
  ],
};

/* --------------------------------------------------------------- commercial */

const commercial: SeedPage = {
  slug: "commercial",
  title: "Commercial media",
  kicker: "For professionals",
  summary: "Virtual tours and aerial video for realtors, developers and property managers.",
  hero: {
    heading: "Listing media, on a schedule you can plan around",
    lede: "Virtual tours priced by square footage, aerial video priced flat. Booked the same way every week, delivered the next business day.",
    ctaHref: "/build?service=virtual-tours",
    ctaLabel: "Book a shoot",
  },
  sections: [
    {
      kind: "prose",
      payload: {
        heading: "Built for repeat buyers",
        paragraphs: [
          "Listing media is not an event. You are not planning it once — you are ordering it again next week, and what matters is that the price is known and the turnaround is predictable.",
          "Tours are priced by square-footage tier, so a listing quotes itself from the sheet. Aerial work is a flat rate whether it is added to a shoot or flown on its own.",
        ],
      },
    },
    {
      kind: "volume",
      payload: {
        heading: "Recurring shoots",
        text: "Booking regularly? A coordinator sets a volume rate across your listings instead of pricing each one. Send a request with your typical monthly count and we will come back with terms.",
        ctaHref: "/build?service=virtual-tours",
        ctaLabel: "Start a request",
      },
    },
    {
      kind: "note",
      payload: {
        heading: "About aerial work",
        text: "Aerial flights are flown by insured local pilots who handle the airspace checks and site permissions for each shoot. Pilot credentials are supplied on request for a specific booking.",
      },
    },
    {
      kind: "faq",
      payload: {
        question: "Can tours and aerial be booked together?",
        answer: "Yes — tick both in the builder and the total covers the whole package.",
      },
    },
    {
      kind: "faq",
      payload: {
        question: "Do you invoice a brokerage rather than an agent?",
        answer: "We can. Say so in the request notes and a coordinator sets it up.",
      },
    },
  ],
};

/* ------------------------------------------------------------------ pricing */

const pricing: SeedPage = {
  slug: "pricing",
  title: "Pricing",
  kicker: "No quotes on request",
  summary: "Every rate we charge, published. The builder sums them live.",
  hero: {
    heading: "What things cost",
    lede: "The same figures the builder prices against — nothing here is restated by hand.",
    ctaHref: "/build",
    ctaLabel: "Build my event",
  },
  sections: [
    {
      kind: "note",
      payload: {
        heading: "How to read this",
        text: "Rates are per item, per hour or per package depending on the service. Tick what you need in the builder and the running total does the arithmetic — to the penny.",
      },
    },
    {
      kind: "note",
      payload: {
        heading: "What is not on this page",
        text: "Travel outside the Raleigh area, and anything a coordinator customises for a wedding or a 100-plus-guest event. Both are confirmed before you commit to them.",
      },
    },
    {
      kind: "faq",
      payload: {
        question: "Are there booking fees?",
        answer: "No. The price on the line is the price of the service.",
      },
    },
    {
      kind: "faq",
      payload: {
        question: "Do prices change?",
        answer: "Rarely, and never mid-request: if the catalogue moves while you are building, the submission tells you and shows the new total rather than quoting you the old one.",
      },
    },
  ],
};

/* -------------------------------------------------------------------- build */

const build: SeedPage = {
  slug: "build",
  title: "Build my event",
  kicker: "The builder",
  summary: "Describe the event, tick the services, watch the total, send one request.",
  hero: {
    heading: "Build my event",
    lede: "Tick what the day needs. The total updates as you go.",
  },
  sections: [
    {
      kind: "step-copy",
      payload: {
        step: 1,
        heading: "Tell us about the event",
        text: "Four things: what kind of event, when, roughly how many people, and the venue ZIP.",
      },
    },
    {
      kind: "step-copy",
      payload: {
        step: 2,
        heading: "Choose your services",
        text: "Tick a tile to open its options. The running total moves with every change, and every line stays visible.",
      },
    },
    {
      kind: "step-copy",
      payload: {
        step: 3,
        heading: "Check the package",
        text: "The full receipt, line by line. Edit any service without losing the rest.",
      },
    },
    {
      kind: "step-copy",
      payload: {
        step: 4,
        heading: "Your details",
        text: "Where to send the quote. A budget band and notes are optional.",
      },
    },
    {
      kind: "step-copy",
      payload: {
        step: 5,
        heading: "Send it",
        text: "One consolidated request. You get a reference straight away and a reply inside one business day.",
      },
    },
    {
      kind: "notice",
      payload: {
        key: "large-event",
        heading: "A coordinator will customise this package",
        text: "Weddings and events over 100 guests are quoted by a coordinator — the total below is a starting point, not the final figure.",
      },
    },
    {
      kind: "notice",
      payload: {
        key: "empty",
        heading: "Nothing configured yet",
        text: "Tick at least one service to send a request.",
      },
    },
  ],
};

export const PAGES: SeedPage[] = [howItWorks, about, faq, commercial, pricing, build];
