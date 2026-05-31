import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-response';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * PATCH /api/admin/licenses/[id]/revoke
 * 
 * Revokes a license token by changing its status to `REVOKED`.
 * This endpoint is protected and requires a valid `ADMIN_API_KEY`.
 * Fully compatible with Next.js 15 & 16 by awaiting `params`.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    // 1. Authenticate the admin request
    if (!verifyAdminAuth(req)) {
      console.warn('[Admin API] Unauthorized attempt to revoke a license.');
      return errorResponse('Unauthorized: Invalid or missing Admin API Key', 401);
    }

    // 2. Await dynamic route parameters to comply with Next.js 15+ specifications
    const resolvedParams = await params;
    const { id } = resolvedParams;

    if (!id) {
      return errorResponse('License ID is required', 400);
    }

    // 3. Verify license existence in PostgreSQL
    const license = await prisma.license.findUnique({
      where: { id },
    });

    if (!license) {
      console.error(`[Admin API] Revocation failed. License ID ${id} not found.`);
      return errorResponse('License not found', 404);
    }

    // 4. Update the license status to 'REVOKED'
    console.log(`[Admin API] Revoking License ID: ${id}, Owner: ${license.email}`);
    const updatedLicense = await prisma.license.update({
      where: { id },
      data: {
        status: 'REVOKED',
      },
    });

    // 5. Respond with success details
    return successResponse({
      message: 'License successfully revoked',
      license: {
        id: updatedLicense.id,
        email: updatedLicense.email,
        status: updatedLicense.status,
        orderId: updatedLicense.orderId,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
