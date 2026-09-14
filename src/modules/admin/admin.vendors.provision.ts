/**
 * Turning an approved application into a working vendor account.
 *
 * This is the hinge of the vendor flow: everything before it is a form a
 * stranger filled in, everything after it is somebody who can sign in and be
 * offered work. Three things have to be true when it finishes, so all three
 * happen in one transaction:
 *
 *   - there is a `users` row for the applicant's address, with role 'vendor'
 *   - there is a `vendors` profile pointing at it and at the application
 *   - the application knows which account it became (`user_id`)
 *
 * It is idempotent. Approving twice — a double click, a status set back to
 * reviewing and forward again — finds the profile that already exists and
 * changes nothing, rather than colliding on `vendors.user_id`.
 *
 * The invite mail is sent after the commit and its failure is not the
 * transaction's problem: the account exists either way, and "forgot password"
 * on the sign-in page reaches the same place the invite link does.
 */

import { withTransaction } from "../../db/pool.js";
import { newId } from "../../lib/ids.js";
import { logger } from "../../lib/logger.js";
import { digest, generateToken, hashPassword } from "../../lib/crypto.js";
import { sendVendorInviteEmail } from "../../lib/mailer.js";
import { env } from "../../config/env.js";
import * as authRepo from "../auth/auth.repo.js";
import * as vendorRepo from "../vendors/vendors.repo.js";
import type { VendorRow } from "../vendors/vendors.repo.js";

type ApplicationForApproval = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  service_types: string[];
  years_active: number | null;
  service_area: string | null;
  has_insurance: boolean;
  portfolio_url: string | null;
};

export type ProvisionResult = {
  vendor: VendorRow;
  /** True when this call is what created the account (so an invite went out). */
  accountCreated: boolean;
  /** False when the invite could not be delivered — the account still exists. */
  inviteSent: boolean;
};

export async function provisionVendorAccount(
  application: ApplicationForApproval,
): Promise<ProvisionResult> {
  const existing = await vendorRepo.findVendorByApplicationId(application.id);
  if (existing !== null) {
    return { vendor: existing, accountCreated: false, inviteSent: false };
  }

  // A password nobody has ever seen, hashed the same way a chosen one is. The
  // account cannot be signed into until the invite link sets a real one, and
  // there is no plaintext of this anywhere to leak.
  const placeholderHash = await hashPassword(generateToken(32));
  const resetToken = generateToken();

  const result = await withTransaction(async (tx) => {
    const emailKey = application.email.toLowerCase();
    let user = await authRepo.findUserByEmail(emailKey, tx);
    let created = false;

    if (user === null) {
      user = await authRepo.insertUser(
        {
          email: application.email,
          fullName: application.contact_name,
          passwordHash: placeholderHash,
          acceptedTos: false,
          role: "vendor",
          emailVerified: true,
        },
        tx,
      );
      created = true;
    } else if (user.role === "customer") {
      // An existing customer who applied keeps their password and history and
      // gains the portal. An admin is left alone: 'vendor' is not a promotion
      // and demoting the person doing the approving would be a nasty surprise.
      await authRepo.updateUserRole(user.id, "vendor", tx);
    }

    // Someone already holding a profile — approved once under a different
    // application — keeps the one they have.
    const already = await vendorRepo.findVendorByUserId(user.id, tx);
    if (already !== null) {
      await tx.execute("UPDATE vendor_applications SET user_id = $2 WHERE id = $1", [
        application.id,
        user.id,
      ]);
      return { vendor: already, accountCreated: false, needsInvite: false };
    }

    const vendor = await vendorRepo.insertVendor(
      {
        id: newId("vnd"),
        userId: user.id,
        applicationId: application.id,
        businessName: application.business_name,
        contactName: application.contact_name,
        email: application.email,
        phone: application.phone,
        website: application.website,
        serviceTypes: application.service_types ?? [],
        serviceArea: application.service_area,
        yearsActive: application.years_active,
        hasInsurance: application.has_insurance,
        portfolioUrl: application.portfolio_url,
      },
      tx,
    );

    await tx.execute("UPDATE vendor_applications SET user_id = $2 WHERE id = $1", [
      application.id,
      user.id,
    ]);

    // Only a brand-new account needs a way in. Someone who already had a
    // password still has it.
    if (created) {
      await authRepo.insertPasswordReset(
        {
          userId: user.id,
          tokenDigest: digest(resetToken),
          ttlSeconds: env.passwordReset.ttlSeconds,
        },
        tx,
      );
    }

    return { vendor, accountCreated: created, needsInvite: created };
  });

  let inviteSent = false;
  if (result.needsInvite) {
    inviteSent = await sendVendorInviteEmail(
      application.email,
      application.business_name,
      resetToken,
    );
    if (!inviteSent) {
      logger.warn("vendor invite mail not delivered", {
        applicationId: application.id,
        vendorId: result.vendor.id,
      });
    }
  }

  logger.info("vendor account provisioned", {
    applicationId: application.id,
    vendorId: result.vendor.id,
    accountCreated: result.accountCreated,
    inviteSent,
  });

  return { vendor: result.vendor, accountCreated: result.accountCreated, inviteSent };
}
