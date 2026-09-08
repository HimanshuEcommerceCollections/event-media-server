import type { PerkRow } from "./perks.repo.js";

export type PerkDto = {
  key: string;
  /** The card face. The sign-in page renders this inside the scratch card. */
  label: string;
  description: string;
  grantedAt: number;
  revealedAt: number | null;
  redeemedAt: number | null;
  expiresAt: number | null;
};

export const toPerkDto = (row: PerkRow): PerkDto => ({
  key: row.perk_key,
  label: row.label,
  description: row.description,
  grantedAt: row.granted_at,
  revealedAt: row.revealed_at,
  redeemedAt: row.redeemed_at,
  expiresAt: row.expires_at,
});
