/**
 * Minimal structured logger. One JSON line per event in production so a log
 * shipper can parse it; a short human-readable line in development.
 */

import { env } from "../config/env.js";

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = ORDER[env.isProd ? "info" : "debug"];

function emit(level: Level, message: string, fields?: Fields): void {
  if (ORDER[level] < threshold) return;
  if (env.isProd) {
    process.stdout.write(
      `${JSON.stringify({ level, time: new Date().toISOString(), message, ...fields })}\n`,
    );
    return;
  }
  const extra = fields && Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields)}` : "";
  process.stdout.write(`${level.toUpperCase().padEnd(5)} ${message}${extra}\n`);
}

export const logger = {
  debug: (message: string, fields?: Fields) => emit("debug", message, fields),
  info: (message: string, fields?: Fields) => emit("info", message, fields),
  warn: (message: string, fields?: Fields) => emit("warn", message, fields),
  error: (message: string, fields?: Fields) => emit("error", message, fields),
};
