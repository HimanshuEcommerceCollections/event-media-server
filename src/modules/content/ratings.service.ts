/**
 * The star tap on the reviews page.
 *
 * Recorded as a "pulse" rather than a review: there is no body, no name and no
 * moderation, so it is kept apart from the published wall and only reported in
 * aggregate. That is also why it never affects the page's average rating.
 */

import { execute, queryOne } from "../../db/pool.js";
import { newId, nowSeconds } from "../../lib/ids.js";

export async function recordRatingPulse(
  stars: number,
  userId: string | null,
  ip: string | null,
): Promise<{ stars: number; total: number; average: number }> {
  await execute(
    "INSERT INTO rating_pulses (id, stars, user_id, ip, created_at) VALUES ($1, $2, $3, $4, $5)",
    [newId("rtp"), stars, userId, ip, nowSeconds()],
  );

  const row = await queryOne<{ total: number; average: number }>(
    "SELECT COUNT(*)::bigint AS total, COALESCE(AVG(stars), 0)::numeric AS average FROM rating_pulses",
  );

  return {
    stars,
    total: row?.total ?? 1,
    average: Math.round((row?.average ?? stars) * 10) / 10,
  };
}
