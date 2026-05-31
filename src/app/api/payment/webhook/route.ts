import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { createLicenseAfterPayment } from '@/lib/license';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-response';
import { webhookPayloadSchema } from '@/schemas/license.schema';
import { secureCompare } from '@/lib/admin-auth';

/**
 * POST /api/payment/webhook
 * 
 * Handles incoming successful payment webhooks from a payment gateway.
 * Generates, registers, and emails a new license token to the buyer.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;

    // 1. Verify Webhook Signature if secret is defined
    if (webhookSecret) {
      // Look for standard webhook headers: custom 'x-signature', Stripe, Lemon Squeezy, etc.
      const signature = 
        req.headers.get('x-signature') || 
        req.headers.get('stripe-signature') || 
        req.headers.get('x-hub-signature-256');

      if (!signature) {
        console.warn('[Webhook Auth] Signature header is missing.');
        return errorResponse('Webhook signature is missing', 401);
      }

      // Compute HMAC SHA-256 hash using the secret
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      // Normalize signature to strip common prefixes (e.g. sha256=)
      const cleanSignature = signature.replace(/^sha256=/, '');

      // Timing-safe verification
      if (!secureCompare(cleanSignature, expectedSignature)) {
        console.error('[Webhook Auth] Cryptographic signature verification failed.');
        return errorResponse('Invalid webhook signature', 401);
      }
      
      console.log('[Webhook Auth] Webhook signature verified successfully.');
    } else {
      console.warn('[Webhook Warning] PAYMENT_WEBHOOK_SECRET is not configured in env. Bypassing signature check for development.');
    }

    // 2. Parse and validate payload
    let jsonBody: any;
    try {
      jsonBody = JSON.parse(rawBody);
    } catch (parseErr) {
      return errorResponse('Invalid JSON body', 400);
    }

    const validatedData = webhookPayloadSchema.parse(jsonBody);

    // 3. Create License, Save to DB, Email raw token to buyer
    console.log(`[Webhook] Processing successful payment for Order: ${validatedData.orderId}, Email: ${validatedData.email}`);
    
    const rawToken = await createLicenseAfterPayment({
      email: validatedData.email,
      orderId: validatedData.orderId,
    });

    // 4. Return success along with the raw token to show on screen
    return successResponse(
      {
        message: 'License token created and emailed successfully',
        token: rawToken,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
