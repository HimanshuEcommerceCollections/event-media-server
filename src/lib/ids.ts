import { randomUUID } from "node:crypto";

/**
 * Prefixed ids (`usr_…`, `ses_…`) so an id in a log or a request body says
 * what kind of thing it points at.
 */
export const newId = (prefix: string): string => `${prefix}_${randomUUID().replaceAll("-", "")}`;

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);
