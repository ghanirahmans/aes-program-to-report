import { NextRequest } from 'next/server';
import { activateLicense } from '@/lib/license';
import { rateLimit } from '@/lib/rate-limit';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-response';
import { activateLicenseSchema } from '@/schemas/license.schema';

/**
 * POST /api/license/activate
 * 
 * Activates a given license token.
 * Rate-limited to 5 requests per minute per IP.
 * Performs database status transitions atomically to prevent double usage.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Resolve client IP for Rate Limiting
    const rawIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const clientIp = rawIp.split(',')[0].trim();

    // 2. Enforce Rate Limit: Max 5 requests per minute per IP
    const limitCheck = rateLimit(clientIp, 5, 60000);

    // If rate limited, respond with HTTP 429 and Retry-After header
    if (!limitCheck.success) {
      const retryAfterSeconds = Math.max(1, Math.ceil((limitCheck.reset - Date.now()) / 1000));
      const limitResponse = errorResponse('Too many activation attempts. Please wait before trying again.', 429);
      
      limitResponse.headers.set('X-RateLimit-Limit', limitCheck.limit.toString());
      limitResponse.headers.set('X-RateLimit-Remaining', limitCheck.remaining.toString());
      limitResponse.headers.set('X-RateLimit-Reset', Math.ceil(limitCheck.reset / 1000).toString());
      limitResponse.headers.set('Retry-After', retryAfterSeconds.toString());
      
      console.warn(`[Rate Limit] Blocked IP ${clientIp} from activating due to rate limits. Resets in ${retryAfterSeconds}s.`);
      return limitResponse;
    }

    // 3. Validate body structure using Zod Schema
    let jsonBody: any;
    try {
      jsonBody = await req.json();
    } catch (err) {
      return errorResponse('Invalid JSON body', 400);
    }

    const validatedInput = activateLicenseSchema.parse(jsonBody);

    // 4. Perform atomic activation
    console.log(`[Activation] Attempting to activate token from IP: ${clientIp}`);
    const activationResult = await activateLicense(validatedInput.token);

    // 5. Structure Response
    if (!activationResult.success) {
      const failResponse = errorResponse(activationResult.message, 400);
      failResponse.headers.set('X-RateLimit-Limit', limitCheck.limit.toString());
      failResponse.headers.set('X-RateLimit-Remaining', limitCheck.remaining.toString());
      return failResponse;
    }

    const successRes = successResponse({
      message: activationResult.message,
    });
    
    successRes.headers.set('X-RateLimit-Limit', limitCheck.limit.toString());
    successRes.headers.set('X-RateLimit-Remaining', limitCheck.remaining.toString());
    
    console.log(`[Activation] Token activation SUCCESS from IP: ${clientIp}`);
    return successRes;
  } catch (error) {
    return handleApiError(error);
  }
}
