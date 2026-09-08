import { queryOne, execute, type Tx } from "../../db/pool.js";
import { newId, nowSeconds } from "../../lib/ids.js";

export type PerkRow = {
  id: string;
  user_id: string;
  perk_key: string;
  label: string;
  description: string;
  granted_at: number;
  revealed_at: number | null;
  redeemed_at: number | null;
  expires_at: number | null;
};

type Runner = Pick<Tx, "queryOne" | "execute">;
const direct: Runner = { queryOne, execute };
const on = (tx?: Tx): Runner => tx ?? direct;

export const findPerkByUser = (userId: string, tx?: Tx): Promise<PerkRow | null> =>
  on(tx).queryOne<PerkRow>("SELECT * FROM perks WHERE user_id = $1", [userId]);

/**
 * Idempotent by design: a user has exactly one welcome gift, so a repeated
 * grant (a retried verification) returns the perk already drawn rather than
 * re-rolling it — the label is shown on a scratch card that must not change
 * between one load and the next.
 */
export async function grantPerk(
  input: {
    userId: string;
    perkKey: string;
    label: string;
    description: string;
    expiresInDays?: number;
  },
  tx?: Tx,
): Promise<PerkRow> {
  const now = nowSeconds();
  const row = await on(tx).queryOne<PerkRow>(
    `INSERT INTO perks (id, user_id, perk_key, label, description, granted_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET user_id = perks.user_id
     RETURNING *`,
    [
      newId("prk"),
      input.userId,
      input.perkKey,
      input.label,
      input.description,
      now,
      input.expiresInDays === undefined ? null : now + input.expiresInDays * 86_400,
    ],
  );
  if (row === null) throw new Error("grantPerk returned no row");
  return row;
}

/** First reveal wins, so the timestamp records when the card was scratched. */
export const markPerkRevealed = (userId: string, tx?: Tx): Promise<PerkRow | null> =>
  on(tx).queryOne<PerkRow>(
    `UPDATE perks
        SET revealed_at = COALESCE(revealed_at, $2)
      WHERE user_id = $1
      RETURNING *`,
    [userId, nowSeconds()],
  );
