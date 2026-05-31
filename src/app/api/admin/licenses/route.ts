import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-response';

/**
 * GET /api/admin/licenses
 * 
 * Retrieves all license tokens stored in the system.
 * This endpoint is protected and requires a valid `ADMIN_API_KEY`.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate the admin request
    if (!verifyAdminAuth(req)) {
      console.warn('[Admin API] unauthorized attempt to list licenses.');
      return errorResponse('Unauthorized: Invalid or missing Admin API Key', 401);
    }

    // 2. Retrieve all licenses from PostgreSQL
    console.log('[Admin API] Fetching all licenses.');
    const licenses = await prisma.license.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 3. Return the licenses
    return successResponse({
      count: licenses.length,
      licenses,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
