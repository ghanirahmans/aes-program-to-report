import crypto from 'crypto';

/**
 * Hashes a raw token string using SHA-256 and returns a hex representation.
 * This is used to securely store and look up licenses without saving the raw keys.
 * 
 * @param token Raw license token (16-character string)
 * @returns SHA-256 hash in hex format
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
