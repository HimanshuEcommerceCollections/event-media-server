/**
 * POST /api/v1/analytics/events — build_add_service, build_total_view
 *
 * Stubbed by design: the rows are kept so the builder funnel can be counted
 * later, and nothing reads them yet. Only the named events are accepted, so a
 * page cannot quietly turn this into a general-purpose log.
 *
 * `sessionKey` is whatever opaque string the client generates for itself. It
 * is not minted here and is not a user id, so a row cannot be walked back to a
 * person; a signed-in caller is attributed by token instead.
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { noContent } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { recordEvents } from "./analytics.service.js";

export const analyticsRouter = Router();

export const ANALYTICS_EVENTS = ["build_add_service", "build_total_view"] as const;

const event = z.object({
  name: z.enum(ANALYTICS_EVENTS),
  sessionKey: z.string().trim().max(120).optional(),
  // Small and free-form — a service slug, a tile count, a total in cents.
  payload: z.record(z.string().max(40), z.unknown()).default({}),
});

const batchSchema = z.object({ events: z.array(event).min(1).max(20) });

analyticsRouter.post(
  "/events",
  rateLimit({ scope: "analytics", max: 120, windowSeconds: 60 }),
  validate(batchSchema),
  asyncHandler(async (req, res) => {
    const { events } = req.body as z.infer<typeof batchSchema>;
    await recordEvents(events, req.auth?.userId ?? null);
    // Nothing to hand back; a beacon should not wait on a body.
    noContent(res);
  }),
);
