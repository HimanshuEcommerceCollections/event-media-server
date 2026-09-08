/**
 * The review wall, the spotlight carousel and the photo marquee.
 *
 * `categoryKey` is a service slug so the filter chips can be derived from the
 * catalogue instead of maintained as a second list. The three spotlight
 * entries are rows on the wall too — flagged, not duplicated, so an edit
 * cannot leave the two disagreeing.
 *
 * The star histogram is not seeded: it is computed from these rows.
 */

export type SeedReview = {
  id: string;
  categoryKey: string;
  serviceLabel: string;
  authorName: string;
  initials: string;
  avatarColor: string;
  stars: number;
  body: string;
  whenLabel: string;
  isSpotlight?: boolean;
  /** The carousel's longer cut of the quote, when it differs from the wall's. */
  spotlightQuote?: string;
  /** The carousel's tag, which names the event as well as the service. */
  spotlightTag?: string;
  imagePath?: string;
};

export const REVIEWS: readonly SeedReview[] = [
  {
    id: "rvw_priya_marcus",
    categoryKey: "party-rentals",
    serviceLabel: "Party rentals",
    authorName: "Priya & Marcus",
    initials: "PM",
    avatarColor: "#639922",
    stars: 5,
    body: "One request and our whole backyard wedding came together — tables, lounge, string lights, all set up before we arrived. Effortless.",
    whenLabel: "June · verified",
    isSpotlight: true,
    spotlightTag: "Party rentals · Backyard wedding",
    imagePath: "/assets/reviews/spot-1.jpg",
  },
  {
    id: "rvw_aisha_k",
    categoryKey: "dj-music",
    serviceLabel: "DJ + music",
    authorName: "Aisha K.",
    initials: "AK",
    avatarColor: "#e0b341",
    stars: 5,
    body: "The DJ read the room perfectly — the dance floor did not empty once all night!",
    whenLabel: "April · verified",
    isSpotlight: true,
    spotlightQuote:
      "The DJ read the room perfectly — the dance floor did not empty once all night. Everyone asked who we booked.",
    spotlightTag: "DJ + music · Corporate gala",
    imagePath: "/assets/reviews/spot-2.jpg",
  },
  {
    id: "rvw_delgado",
    categoryKey: "entertainers",
    serviceLabel: "Entertainers",
    authorName: "The Delgado Family",
    initials: "TD",
    avatarColor: "#6fb0d6",
    stars: 5,
    body: "The magician had our kids (and honestly the adults) completely speechless.",
    whenLabel: "May · verified",
  },
  {
    id: "rvw_northside",
    categoryKey: "virtual-tours",
    serviceLabel: "Virtual tours",
    authorName: "Northside Realty",
    initials: "NR",
    avatarColor: "#e79ab5",
    stars: 5,
    body: "Our listings sell faster with the 3D tours, and the volume pricing is a real win.",
    whenLabel: "ongoing · verified",
  },
  {
    id: "rvw_tom_riley",
    categoryKey: "photo-video",
    serviceLabel: "Photo + video",
    authorName: "Tom & Riley",
    initials: "TR",
    avatarColor: "#e8934b",
    stars: 5,
    body: "Edited gallery back in three days, and the drone shots were unreal.",
    whenLabel: "March · verified",
  },
  {
    id: "rvw_cardinal",
    categoryKey: "drone-video",
    serviceLabel: "Drone video",
    authorName: "Cardinal Coworking",
    initials: "CC",
    avatarColor: "#8a7bd8",
    stars: 4,
    body: "Aerials made our launch video pop. Booking was smooth and the pilot was a pro.",
    whenLabel: "Feb · verified",
  },
  {
    id: "rvw_bianca",
    categoryKey: "party-rentals",
    serviceLabel: "Party rentals",
    authorName: "Bianca M.",
    initials: "BM",
    avatarColor: "#3b9a8f",
    stars: 5,
    body: "Chairs, tables, lighting — delivered and set up before I even got there. Spotless!",
    whenLabel: "July · verified",
  },
  {
    id: "rvw_grace",
    categoryKey: "entertainers",
    serviceLabel: "Entertainers",
    authorName: "Grace H.",
    initials: "GH",
    avatarColor: "#d96a5b",
    stars: 5,
    body: "A face painter and balloon artist kept thirty kids happy for hours. Lifesavers.",
    whenLabel: "June · verified",
  },
  {
    id: "rvw_elm_hoa",
    categoryKey: "dj-music",
    serviceLabel: "DJ + music",
    authorName: "Elm Street HOA",
    initials: "EH",
    avatarColor: "#639922",
    stars: 5,
    body: "Booked, matched and done in minutes. The whole neighborhood loved it.",
    whenLabel: "May · verified",
  },
  {
    id: "rvw_devon_sam",
    categoryKey: "photo-video",
    serviceLabel: "Photo + video",
    authorName: "Devon & Sam",
    initials: "DS",
    avatarColor: "#e0b341",
    stars: 5,
    body: "Every candid moment captured beautifully. Worth every single penny.",
    whenLabel: "October · verified",
  },
  {
    id: "rvw_harbor",
    categoryKey: "virtual-tours",
    serviceLabel: "Virtual tours",
    authorName: "Harbor Group",
    initials: "HG",
    avatarColor: "#6fb0d6",
    stars: 5,
    body: "Buyers walk the space before they ever visit. An absolute game changer.",
    whenLabel: "ongoing · verified",
    isSpotlight: true,
    spotlightQuote:
      "Buyers walk the space before they ever visit. For our listings, it’s an absolute game changer.",
    spotlightTag: "Virtual tours · Real estate",
    imagePath: "/assets/reviews/spot-3.jpg",
  },
  {
    id: "rvw_lena",
    categoryKey: "drone-video",
    serviceLabel: "Drone video",
    authorName: "Lena P.",
    initials: "LP",
    avatarColor: "#e79ab5",
    stars: 5,
    body: "The sunset flyover of our venue gave every guest chills. Stunning.",
    whenLabel: "September · verified",
  },
];

/**
 * The scrolling photo strip. The view prints the row twice so the -50%
 * keyframe loops seamlessly; that duplication stays in the view, since it is
 * an animation detail rather than content.
 */
export const REVIEW_MARQUEE = [
  { imagePath: "/assets/reviews/spot-2.jpg", label: "Neon bash" },
  { imagePath: "/assets/reviews/marq-carnival.jpg", label: "Carnival" },
  { imagePath: "/assets/reviews/spot-1.jpg", label: "Lakeside wedding" },
  { imagePath: "/assets/reviews/marq-album-party.jpg", label: "Album party" },
  { imagePath: "/assets/reviews/spot-3.jpg", label: "Brand summit" },
  { imagePath: "/assets/reviews/marq-family-fest.jpg", label: "Family fest" },
  { imagePath: "/assets/reviews/marq-garden-vows.jpg", label: "Garden vows" },
  { imagePath: "/assets/reviews/marq-launch-day.jpg", label: "Launch day" },
  { imagePath: "/assets/reviews/marq-film-night.jpg", label: "Film night" },
] as const;
