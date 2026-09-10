/**
 * /api/v1/admin/* — the coordinator/back-office API.
 *
 * Every route here is gated on requireAuth + requireAdmin, applied once at
 * the top of this router rather than repeated per handler.
 */

import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { ok } from "../../lib/http.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { getSummary } from "./admin.summary.service.js";
import { adminBookingsRouter } from "./admin.bookings.routes.js";
import { adminVendorsRouter } from "./admin.vendors.routes.js";
import { adminUsersRouter } from "./admin.users.routes.js";
import { adminContentRouter } from "./admin.content.routes.js";
import { adminServicesRouter } from "./admin.services.routes.js";
import { adminBundlesRouter } from "./admin.bundles.routes.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    ok(res, await getSummary());
  }),
);

adminRouter.use("/bookings", adminBookingsRouter);
adminRouter.use("/vendors", adminVendorsRouter);
adminRouter.use("/users", adminUsersRouter);
adminRouter.use("/services", adminServicesRouter);
adminRouter.use("/bundles", adminBundlesRouter);
// Mounts /content-pages, /legal-documents, /gallery-items, /featured-events,
// /categories, /stats, /reviews itself.
adminRouter.use(adminContentRouter);
