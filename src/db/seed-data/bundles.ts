/**
 * Packages that seed the builder.
 *
 * `/packages` is a Launch page and may stub — the convention it deposits is
 * live now. Each item carries the same `configuration` object the builder
 * posts for that service, so seeding a bundle and configuring a tile by hand
 * reach the pricing engine by exactly one path and cannot disagree.
 *
 * No totals are stored. A bundle costs whatever its lines price to, which is
 * computed on read; a cached number here would be the one that goes stale.
 */

export type SeedBundle = {
  slug: string;
  name: string;
  tagline: string;
  blurb: string;
  eventType: string;
  badge: string | null;
  imagePath: string | null;
  imageAlt: string | null;
  items: { serviceSlug: string; configuration: Record<string, unknown> }[];
};

export const BUNDLES: SeedBundle[] = [
  {
    slug: "backyard-party",
    name: "Backyard party",
    tagline: "Seating, music and a photographer for the afternoon",
    blurb: "The reliable small-garden set-up: enough seating for thirty, four hours of music, and someone taking pictures while you host.",
    eventType: "birthday",
    badge: "Most booked",
    imagePath: "/assets/kit-backyard-party.jpg",
    imageAlt: "Garden party set for thirty guests",
    items: [
      {
        serviceSlug: "party-rentals",
        configuration: { quantities: { chair: 30, table: 4, linen: 4, lighting: 1 } },
      },
      { serviceSlug: "dj-music", configuration: { hours: 4, addons: ["uplighting"] } },
      { serviceSlug: "photo-video", configuration: { pack: "photo-2" } },
    ],
  },
  {
    slug: "wedding-essentials",
    name: "Wedding essentials",
    tagline: "The full day, staged and filmed",
    blurb: "Seating and a tent for a hundred and twenty, eight hours of music with an MC, and the cinematic photo-and-video package with a second shooter.",
    eventType: "wedding",
    badge: "Coordinator reviewed",
    imagePath: "/assets/kit-wedding.jpg",
    imageAlt: "Wedding reception under a marquee",
    items: [
      {
        serviceSlug: "party-rentals",
        configuration: {
          quantities: { chair: 120, table: 15, linen: 15, tent: 1, dancefloor: 1, lighting: 2 },
        },
      },
      { serviceSlug: "dj-music", configuration: { hours: 8, addons: ["uplighting", "mc"] } },
      {
        serviceSlug: "photo-video",
        configuration: { pack: "cinematic", addons: ["second-shooter", "drone"] },
      },
    ],
  },
  {
    slug: "kids-birthday",
    name: "Kids birthday",
    tagline: "An entertainer and somewhere for everyone to sit",
    blurb: "Two hours of face painting, seating for twenty and a string-light kit for when it runs late.",
    eventType: "birthday",
    badge: null,
    imagePath: "/assets/kit-kids-birthday.jpg",
    imageAlt: "Children at a decorated birthday party",
    items: [
      {
        serviceSlug: "party-rentals",
        configuration: { quantities: { chair: 20, table: 3, linen: 3, lighting: 1 } },
      },
      { serviceSlug: "entertainers", configuration: { performer: "face-painter", hours: 2 } },
    ],
  },
  {
    slug: "listing-media",
    name: "Listing media",
    tagline: "Tour and aerial, next business day",
    blurb: "The standard listing package for a mid-size home: a hosted virtual tour with a floor plan, plus an aerial exterior.",
    eventType: "listing",
    badge: "For realtors",
    imagePath: "/assets/ev-04-elm-st-listing.jpg",
    imageAlt: "Property exterior photographed from the air",
    items: [
      {
        serviceSlug: "virtual-tours",
        configuration: { pack: "1500-3000", addons: ["floor-plan", "hosting"] },
      },
      { serviceSlug: "drone-video", configuration: { pack: "addon" } },
    ],
  },
];
