/**
 * /api/v1/admin/users/* — account management. Mounted under adminRouter,
 * which already gates on requireAuth + requireAdmin.
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { ok } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { parsePageQuery } from "../../lib/pagination.js";
import { listUsers, updateUserRole } from "./admin.users.service.js";

export const adminUsersRouter = Router();

const listQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

const idParams = z.object({ id: z.string().trim().min(1).max(200) });

adminUsersRouter.get(
  "/",
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { search } = req.validatedQuery as z.infer<typeof listQuerySchema>;
    const { page, pageSize, offset } = parsePageQuery(req.validatedQuery);
    ok(res, await listUsers(search, page, pageSize, offset));
  }),
);

adminUsersRouter.patch(
  "/:id/role",
  validate(idParams, "params"),
  validate(z.object({ role: z.enum(["customer", "admin"]) })),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    const { role } = req.body as { role: string };
    ok(res, await updateUserRole(id, role, req.auth!.userId));
  }),
);
