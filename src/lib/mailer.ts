/**
 * SMTP delivery for the two mails the auth flow depends on: the one-time code
 * that completes a sign-in, and the link that completes a password reset.
 *
 * Two things shape this module:
 *  - Delivery is best-effort from the caller's point of view. A send happens
 *    after the challenge is already stored, so a provider outage must not turn
 *    a valid sign-in attempt into a 500 - it is logged and the caller still
 *    gets its "code sent" answer, which is also what keeps the endpoint from
 *    reporting whether an address exists.
 *  - With no SMTP_HOST the transport is never built and every send is a no-op,
 *    so a local run needs no provider. Production cannot reach that state:
 *    assertMailConfigured refuses to boot without one.
 */

import nodemailer, { type Transporter } from "nodemailer";

import { env } from "../config/env.js";
import { logger } from "./logger.js";

let transporter: Transporter | null = null;

function transport(): Transporter | null {
  if (!env.mail.enabled) return null;
  if (transporter === null) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: { user: env.mail.user, pass: env.mail.password },
      connectionTimeout: env.mail.timeoutMs,
      greetingTimeout: env.mail.timeoutMs,
      socketTimeout: env.mail.timeoutMs,
      // One connection reused across sends: Gmail throttles hard on churn.
      pool: true,
      maxConnections: 3,
    });
  }
  return transporter;
}

/**
 * Proves the credentials work at boot rather than at the first sign-in. A
 * failure is logged, not thrown: an SMTP host that is briefly unreachable
 * should not keep the whole API from serving its public content.
 */
export async function verifyMailer(): Promise<void> {
  const tx = transport();
  if (tx === null) {
    logger.warn("mail delivery is OFF - SMTP_HOST is not set, codes are logged instead");
    return;
  }
  try {
    await tx.verify();
    logger.info("mail transport ready", {
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      from: env.mail.from,
    });
  } catch (err: unknown) {
    logger.error("mail transport failed to verify - sign-in mails will not arrive", {
      host: env.mail.host,
      port: env.mail.port,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function closeMailer(): void {
  transporter?.close();
  transporter = null;
}

type Mail = { to: string; subject: string; text: string; html: string };

/** Resolves to false when the mail did not go out, for the caller to log. */
async function send(mail: Mail): Promise<boolean> {
  const tx = transport();
  if (tx === null) return false;
  try {
    const info = await tx.sendMail({ from: env.mail.from, ...mail });
    logger.info("mail sent", { to: mail.to, subject: mail.subject, messageId: info.messageId });
    return true;
  } catch (err: unknown) {
    // Swallowed on purpose - see the note at the top of the file.
    logger.error("mail delivery failed", {
      to: mail.to,
      subject: mail.subject,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/* --------------------------------------------------------------- templates */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Mail clients strip <style> blocks and most of CSS, so everything here is
 * inline and the frame is a table. The plain-text half is not a courtesy:
 * Gmail scores an HTML-only message as spam.
 */
function layout(heading: string, body: string): string {
  const brand = escapeHtml(env.mail.brand);
  return [
    "<!doctype html>",
    '<html><body style="margin:0;padding:24px;background:#f5f4f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1b19">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e6e3de">',
    '<tr><td style="padding:28px 32px 8px">',
    `<div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a8378">${brand}</div>`,
    `<h1 style="margin:12px 0 0;font-size:21px;font-weight:600;line-height:1.3">${escapeHtml(heading)}</h1>`,
    "</td></tr>",
    `<tr><td style="padding:8px 32px 28px;font-size:15px;line-height:1.6;color:#3f3b35">${body}</td></tr>`,
    "</table>",
    '<div style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#8a8378;text-align:center">',
    `Sent by ${brand}. If this was not you, no action is needed.`,
    "</div>",
    "</body></html>",
  ].join("");
}

function minutes(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60));
  return `${m} minute${m === 1 ? "" : "s"}`;
}

/* ----------------------------------------------------------------- senders */

/**
 * The sign-in / sign-up code. The wording differs between the two so a code
 * that arrives unprompted reads as what it is.
 */
export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: "signup" | "signin",
): Promise<boolean> {
  const valid = minutes(env.otp.ttlSeconds);
  const isSignup = purpose === "signup";
  const heading = isSignup ? "Confirm your email" : "Your sign-in code";
  const lead = isSignup
    ? "Welcome. Enter this code to finish setting up your account."
    : "Enter this code to finish signing in.";
  const footer = `The code expires in ${valid}. If you did not ask for it, ignore this message and your account stays as it is.`;

  return send({
    to,
    subject: `${code} is your ${env.mail.brand} ${isSignup ? "confirmation" : "sign-in"} code`,
    text: `${lead}\n\n${code}\n\n${footer}`,
    html: layout(
      heading,
      [
        `<p style="margin:0 0 20px">${lead}</p>`,
        '<div style="font-size:32px;font-weight:600;letter-spacing:.32em;text-align:center;padding:18px 0;background:#faf9f7;border:1px solid #e6e3de;border-radius:10px">',
        escapeHtml(code),
        "</div>",
        `<p style="margin:20px 0 0;color:#6b6559">${footer}</p>`,
      ].join(""),
    ),
  });
}

/**
 * The reset link. The token travels in the URL because the frontend reads it
 * from `?token=`; it is single-use and short-lived, which is what makes that
 * acceptable.
 */
export async function sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
  const url = `${env.appUrl}${env.passwordResetPath}?token=${encodeURIComponent(token)}`;
  const safeUrl = escapeHtml(url);
  const valid = minutes(env.passwordReset.ttlSeconds);
  const lead = "Someone asked to reset the password on this account.";
  const footer = `The link expires in ${valid} and works once. If this was not you, ignore this message - your password stays as it is.`;

  return send({
    to,
    subject: `Reset your ${env.mail.brand} password`,
    text: `${lead} Open the link below to choose a new one.\n\n${url}\n\n${footer}`,
    html: layout(
      "Reset your password",
      [
        `<p style="margin:0 0 20px">${lead} Choose a new one with the button below.</p>`,
        '<p style="margin:0 0 20px;text-align:center">',
        `<a href="${safeUrl}" style="display:inline-block;padding:12px 26px;background:#1c1b19;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">Choose a new password</a>`,
        "</p>",
        '<p style="margin:0 0 20px;font-size:13px;color:#6b6559;word-break:break-all">Or paste this into your browser:<br>',
        `<a href="${safeUrl}" style="color:#6b6559">${safeUrl}</a></p>`,
        `<p style="margin:0;color:#6b6559">${footer}</p>`,
      ].join(""),
    ),
  });
}
