import { NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * Performs a timing-safe string comparison.
 * Compares SHA-256 hashes of the strings to ensure that equal length comparison is met
 * and that comparison time is constant, preventing side-channel timing attacks.
 * 
 * @param a First string
 * @param b Second string
 * @returns boolean True if strings match
 */
export function secureCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  
  const aHash = crypto.createHash('sha256').update(a).digest();
  const bHash = crypto.createHash('sha256').update(b).digest();
  
  return crypto.timingSafeEqual(aHash, bHash);
}

/**
 * Authenticates admin requests against the configured `ADMIN_API_KEY`.
 * Supports both standard "Authorization: Bearer <API_KEY>" and custom "x-admin-api-key: <API_KEY>" headers.
 * 
 * @param req The incoming NextRequest
 * @returns boolean True if authenticated successfully
 */
export function verifyAdminAuth(req: NextRequest): boolean {
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (!adminApiKey) {
    console.warn('[Admin Auth] WARNING: ADMIN_API_KEY is not defined in your environment variables.');
    return false;
  }

  // 1. Extract Bearer Token from Authorization Header
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return secureCompare(token, adminApiKey);
  }

  // 2. Extract Token from Custom Header
  const customHeader = req.headers.get('x-admin-api-key');
  if (customHeader) {
    return secureCompare(customHeader, adminApiKey);
  }

  return false;
}
