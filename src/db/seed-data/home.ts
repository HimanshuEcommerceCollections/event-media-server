/**
 * Landing-page content: the featured events strip, the category marquee, the
 * testimonial rail and the four count-up stats.
 *
 * These are the same values frontend/app/content-fallback.js holds as its
 * offline copy. Change one and change the other.
 */

export const FEATURED_EVENTS = [
  {
    slug: "reeves-wedding",
    name: "The Reeves Wedding",
    year: 2026,
    totalCents: 648_000,
    totalLabel: "$6,480",
    imagePath: "/assets/ev-01-reeves-wedding.jpg",
    imageAlt: "Wedding being filmed",
  },
  {
    slug: "downtown-gala",
    name: "Downtown Gala",
    year: 2026,
    totalCents: 390_000,
    totalLabel: "$3,900",
    imagePath: "/assets/ev-02-downtown-gala.jpg",
    imageAlt: "Luxury gala",
  },
  {
    slug: "maple-st-birthday",
    name: "Maple St Birthday",
    year: 2026,
    totalCents: 124_000,
    totalLabel: "$1,240",
    imagePath: "/assets/ev-03-maple-st-birthday.jpg",
    imageAlt: "Celebration venue",
  },
  {
    slug: "elm-st-listing",
    name: "Elm St Listing",
    year: 2026,
    totalCents: 62_400,
    totalLabel: "$624",
    imagePath: "/assets/ev-04-elm-st-listing.jpg",
    imageAlt: "Listing property",
  },
] as const;

export const CATEGORIES = [
  { key: "weddings", label: "Weddings" },
  { key: "birthdays", label: "Birthdays" },
  { key: "corporate", label: "Corporate" },
  { key: "galas", label: "Galas" },
  { key: "listings", label: "Listings" },
  { key: "drone", label: "Drone" },
] as const;

export const TESTIMONIALS = [
  {
    id: "tst_home_1",
    quote:
      "One form and our whole wedding was handled — DJ, rentals, photographer, all on a single quote. I stopped emailing five vendors.",
    authorName: "Jordan & Riya",
    authorRole: "Wedding · Raleigh",
    initials: "JR",
  },
  {
    id: "tst_home_2",
    quote:
      "The running total is the best part — I could see exactly what each add-on cost before committing. No surprises on the invoice.",
    authorName: "Marcus P.",
    authorRole: "Corporate gala",
    initials: "MP",
  },
  {
    id: "tst_home_3",
    quote:
      "I order listing media every week now. Virtual tour plus drone in one request, delivered the next day. It's my default.",
    authorName: "Sana L.",
    authorRole: "Realtor · B2B",
    initials: "SL",
  },
  {
    id: "tst_home_4",
    quote:
      "Booked a magician, a bounce castle and a photographer for my son's birthday in ten minutes flat. The coordinator handled the rest.",
    authorName: "Priya N.",
    authorRole: "Kids' birthday",
    initials: "PN",
  },
] as const;

/**
 * `prefix` and `suffix` wrap the animated number, so "$0" and "100%" both come
 * out of the same count-up component.
 */
export const HOME_STATS = [
  { key: "services_count", value: 6, decimals: 0, prefix: "", suffix: "", label: "services, one request" },
  { key: "reply_days", value: 1, decimals: 0, prefix: "", suffix: "", label: "business-day reply" },
  { key: "accuracy", value: 100, decimals: 0, prefix: "", suffix: "%", label: "penny-accurate total" },
  { key: "submit_cost", value: 0, decimals: 0, prefix: "$", suffix: "", label: "to submit a request" },
] as const;

/** The reviews page's own count-ups, which are a different four. */
export const REVIEW_STATS = [
  { key: "events_covered", value: 320, decimals: 0, prefix: "", suffix: "", label: "Events covered" },
  { key: "average_rating", value: 4.9, decimals: 1, prefix: "", suffix: "", label: "Average rating" },
  { key: "five_star", value: 96, decimals: 0, prefix: "", suffix: "%", label: "Five-star" },
  { key: "repeat_clients", value: 38, decimals: 0, prefix: "", suffix: "%", label: "Repeat clients" },
] as const;
