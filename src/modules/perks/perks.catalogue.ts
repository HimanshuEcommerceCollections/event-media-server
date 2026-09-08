/**
 * The welcome gifts a new account can draw.
 *
 * The draw happens server-side, once, when the sign-up code is verified — not
 * in the scratch-card component. Otherwise a reload would re-roll the gift and
 * nothing could be honoured against a booking.
 *
 * `weight` is relative, so a gift's odds can be changed without the numbers
 * having to add up to anything in particular.
 */

import { randomInt } from "node:crypto";

export type PerkDefinition = {
  key: string;
  /** Shown on the card face; kept short, it is set in the display face. */
  label: string;
  description: string;
  weight: number;
  expiresInDays: number;
};

export const PERKS: readonly PerkDefinition[] = [
  {
    key: "free_uplighting",
    label: "Free uplighting",
    description: "Uplighting added to any DJ booking, at no charge.",
    weight: 24,
    expiresInDays: 180,
  },
  {
    key: "drone_addon_free",
    label: "Free drone add-on",
    description: "A drone pass added to any photo or video package.",
    weight: 18,
    expiresInDays: 180,
  },
  {
    key: "ten_percent_rentals",
    label: "10% off rentals",
    description: "Ten percent off your first party-rentals order.",
    weight: 22,
    expiresInDays: 180,
  },
  {
    key: "extra_hour_dj",
    label: "Extra DJ hour",
    description: "One extra hour on any DJ + music booking.",
    weight: 16,
    expiresInDays: 180,
  },
  {
    key: "free_photo_booth",
    label: "Free photo booth",
    description: "An open-air photo booth added to any event.",
    weight: 12,
    expiresInDays: 180,
  },
  {
    key: "rush_delivery",
    label: "Free rush delivery",
    description: "Next-day media delivery on your first order.",
    weight: 8,
    expiresInDays: 180,
  },
];

const TOTAL_WEIGHT = PERKS.reduce((sum, perk) => sum + perk.weight, 0);

export function drawPerk(): PerkDefinition {
  // randomInt is uniform over [0, TOTAL_WEIGHT) without the modulo bias a
  // scaled Math.random() would introduce.
  let ticket = randomInt(0, TOTAL_WEIGHT);
  for (const perk of PERKS) {
    if (ticket < perk.weight) return perk;
    ticket -= perk.weight;
  }
  // Unreachable while TOTAL_WEIGHT is the sum of the weights, but the array
  // access has to be proven non-empty for the return type to hold.
  const fallback = PERKS[0];
  if (fallback === undefined) throw new Error("PERKS is empty");
  return fallback;
}
