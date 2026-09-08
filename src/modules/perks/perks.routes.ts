/**
 * GET  /api/v1/perks/me         — the welcome gift on this account, or null
 * POST /api/v1/perks/me/reveal  — records that the scratch card was scratched
 * GET  /api/v1/perks/catalogue  — the gifts that can be drawn (public)
 */

import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { notFound, ok } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { PERKS } from "./perks.catalogue.js";
import { findPerkByUser, markPerkRevealed } from "./perks.repo.js";
import { toPerkDto } from "./perks.dto.js";

export const perksRouter = Router();

perksRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const perk = await findPerkByUser(req.auth!.userId);
    // An account that signed up before the gift existed simply has none; that
    // is not an error, so the client gets an explicit null.
    ok(res, perk === null ? null : toPerkDto(perk));
  }),
);

perksRouter.post(
  "/me/reveal",
  requireAuth,
  asyncHandler(async (req, res) => {
    const perk = await markPerkRevealed(req.auth!.userId);
    if (perk === null) throw notFound("There is no gift on this account.");
    ok(res, toPerkDto(perk));
  }),
);

/** The odds are deliberately not published — only what can come up. */
perksRouter.get("/catalogue", (_req, res) => {
  ok(
    res,
    PERKS.map((p) => ({ key: p.key, label: p.label, description: p.description })),
  );
});
