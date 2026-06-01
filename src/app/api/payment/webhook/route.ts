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
    let jsonBody: any;
    try {
      jsonBody = JSON.parse(rawBody);
    } catch (parseErr) {
      return errorResponse('Invalid JSON body', 400);
    }

    let email = '';
    let orderId = '';
    let isSimulation = true;

    // 1. Identify if it is a standard Midtrans notification
    const isMidtrans = jsonBody.transaction_status && jsonBody.signature_key && jsonBody.order_id;

    if (isMidtrans) {
      isSimulation = false;
      orderId = jsonBody.order_id;
      
      // Extract email from customer_details. If absent, fallback to root email
      email = jsonBody.customer_details?.email || jsonBody.email || '';

      console.log(`[Midtrans Webhook] Received status for order ${orderId}: ${jsonBody.transaction_status}`);

      // Cryptographic signature key verification using MIDTRANS_SERVER_KEY
      const midtransServerKey = process.env.MIDTRANS_SERVER_KEY;
      if (midtransServerKey) {
        const signaturePayload = jsonBody.order_id + jsonBody.status_code + jsonBody.gross_amount + midtransServerKey;
        const expectedSignature = crypto.createHash('sha512').update(signaturePayload).digest('hex');
        
        if (expectedSignature !== jsonBody.signature_key) {
          console.error('[Midtrans Webhook] Signature verification failed.');
          return errorResponse('Invalid signature key', 401);
        }
        console.log('[Midtrans Webhook] Signature key verified successfully.');
      } else {
        console.warn('[Midtrans Webhook] MIDTRANS_SERVER_KEY is not configured in env. Bypassing signature verification.');
      }

      // Filter out non-successful transaction statuses
      const successStatuses = ['settlement', 'capture'];
      if (!successStatuses.includes(jsonBody.transaction_status)) {
        console.log(`[Midtrans Webhook] Transaction status is not settled (${jsonBody.transaction_status}). Ignoring.`);
        return successResponse({ message: `Notification received for non-settlement status: ${jsonBody.transaction_status}` });
      }

      // If fraud_status is present (for credit cards), it must be 'accept'
      if (jsonBody.fraud_status && jsonBody.fraud_status !== 'accept') {
        console.log(`[Midtrans Webhook] Fraud status is ${jsonBody.fraud_status}, transaction rejected.`);
        return successResponse({ message: `Transaction rejected due to fraud status: ${jsonBody.fraud_status}` });
      }

      if (!email) {
        console.error('[Midtrans Webhook] Buyer email is missing from customer_details.');
        return errorResponse('Buyer email is missing from customer_details', 400);
      }
    } else {
      // 2. Local Simulation fallback
      const validatedData = webhookPayloadSchema.parse(jsonBody);
      email = validatedData.email;
      orderId = validatedData.orderId;

      const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
      if (webhookSecret) {
        const signature = 
          req.headers.get('x-signature') || 
          req.headers.get('stripe-signature') || 
          req.headers.get('x-hub-signature-256');

        if (!signature) {
          console.warn('[Webhook Auth] Signature header is missing.');
          return errorResponse('Webhook signature is missing', 401);
        }

        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');

        const cleanSignature = signature.replace(/^sha256=/, '');

        if (!secureCompare(cleanSignature, expectedSignature)) {
          console.error('[Webhook Auth] Cryptographic signature verification failed.');
          return errorResponse('Invalid webhook signature', 401);
        }
      }
    }

    // 3. Create License, Save to DB, Email raw token to buyer
    console.log(`[Webhook] Processing successful payment for Order: ${orderId}, Email: ${email} (${isSimulation ? 'SIMULATED' : 'MIDTRANS'})`);
    
    const rawToken = await createLicenseAfterPayment({
      email,
      orderId,
    });

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
