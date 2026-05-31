import crypto from 'crypto';
import { prisma } from './prisma';
import { hashToken } from './hash';
import { sendLicenseEmail } from './email';

/**
 * Generates a cryptographically secure 16-character license token.
 * Uses only uppercase letters A-Z and digits 0-9.
 * Utilizes `crypto.randomInt` to eliminate modulo bias.
 */
export function generateLicenseToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    token += chars[randomIndex];
  }
  return token;
}

interface CreateLicenseParams {
  email: string;
  orderId: string;
  expiresInDays?: number;
}

/**
 * Generates and saves a new license token after a successful payment.
 * Automatically hashes the token before database insertion and triggers email sending.
 * 
 * @param params Object containing email, orderId, and optional expiresInDays (default 365)
 * @returns Promise<string> The raw, unhashed token (returned ONCE to display to the buyer)
 */
export async function createLicenseAfterPayment(params: CreateLicenseParams): Promise<string> {
  const { email, orderId, expiresInDays = 365 } = params;

  // 1. Generate the raw token (e.g. X9K2M7PQ4L8RD3WT)
  const rawToken = generateLicenseToken();

  // 2. Compute the SHA-256 hash for database storage
  const tokenHash = hashToken(rawToken);

  // 3. Compute the expiration date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // 4. Persist to database (tokenHash and orderId have unique constraints)
  await prisma.license.create({
    data: {
      email,
      tokenHash,
      status: 'UNUSED',
      orderId,
      expiresAt,
    },
  });

  // 5. Send raw token to the buyer's email (asynchronous, but awaited to handle errors)
  await sendLicenseEmail(email, rawToken);

  // 6. Return the raw token so the backend endpoint can return it to the UI
  return rawToken;
}

interface ActivationResult {
  success: boolean;
  message: string;
}

/**
 * Activates a license token atomically.
 * Guarantees that even if identical parallel activation requests hit the server,
 * only ONE request will succeed in transitioning the token from UNUSED to USED.
 * 
 * @param token The raw license token input by the user
 * @returns Promise<ActivationResult> Success or error message
 */
export async function activateLicense(token: string): Promise<ActivationResult> {
  // 1. Hash the incoming token
  const computedHash = hashToken(token);

  // 2. Perform an atomic update with updateMany.
  // The DB updates the record only if tokenHash matches, status is UNUSED, and the token is not expired.
  const updateResult = await prisma.license.updateMany({
    where: {
      tokenHash: computedHash,
      status: 'UNUSED',
      expiresAt: {
        gt: new Date(),
      },
    },
    data: {
      status: 'USED',
      usedAt: new Date(),
    },
  });

  // 3. Evaluate results
  if (updateResult.count === 1) {
    return {
      success: true,
      message: 'License activated',
    };
  }

  // If count is 0, it means the token doesn't exist, is already USED, EXPIRED, or REVOKED.
  return {
    success: false,
    message: 'Invalid, expired, or already used token',
  };
}
