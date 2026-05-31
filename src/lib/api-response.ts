import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Generates a standardized successful JSON API response.
 * 
 * @param data Object to merge with the response (e.g. { message: "...", data: {...} })
 * @param status HTTP Status Code (default 200)
 */
export function successResponse(data: Record<string, any>, status = 200) {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    { status }
  );
}

/**
 * Generates a standardized error JSON API response.
 * 
 * @param message Human-readable error description
 * @param status HTTP Status Code (default 400)
 * @param details Optional additional debugging details or field-level validation errors
 */
export function errorResponse(message: string, status = 400, details?: any) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    { status }
  );
}

/**
 * Global API error handler utility.
 * Catch-all for API route handlers that logs the exception and formats Zod validation errors
 * or standard server crashes into consistent JSON responses.
 * 
 * @param error The thrown error object
 * @returns NextResponse formatted standard error
 */
export function handleApiError(error: any): NextResponse {
  console.error('[API Handler Error]:', error);

  // Handle schema validation errors from Zod
  if (error instanceof ZodError) {
    const formattedValidationErrors = error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    return errorResponse('Validation failed', 400, formattedValidationErrors);
  }

  // Handle generic runtime or DB exceptions
  const isDev = process.env.NODE_ENV === 'development';
  return errorResponse(
    'An internal server error occurred',
    500,
    isDev ? { message: error.message, stack: error.stack } : undefined
  );
}
