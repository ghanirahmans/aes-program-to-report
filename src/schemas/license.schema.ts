import { z } from 'zod';

/**
 * Schema for verifying incoming token activation requests.
 * Constraints:
 * - token is mandatory
 * - must be exactly 16 characters long
 * - must consist only of uppercase capital letters (A-Z) and numbers (0-9)
 */
export const activateLicenseSchema = z.object({
  token: z
    .string()
    .length(16, { message: 'Token must be exactly 16 characters' })
    .regex(/^[A-Z0-9]+$/, {
      message: 'Token must contain only uppercase letters (A-Z) and numbers (0-9)',
    }),
});

/**
 * Schema for verifying incoming payment success webhooks.
 * Constraints:
 * - email is mandatory and must be a valid email format
 * - orderId is mandatory and cannot be empty
 */
export const webhookPayloadSchema = z.object({
  email: z
    .string()
    .email({ message: 'Invalid email format' }),
  orderId: z
    .string()
    .min(1, { message: 'Order ID cannot be empty' }),
});

export type ActivateLicenseInput = z.infer<typeof activateLicenseSchema>;
export type WebhookPayloadInput = z.infer<typeof webhookPayloadSchema>;
