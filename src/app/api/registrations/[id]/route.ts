import { NextRequest, NextResponse } from 'next/server';
import { getRegistrationById, updateRegistration } from '@/lib/registrations/actions';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/registrations/[id]
 * Fetch single registration with documents and signed URLs
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const res = await getRegistrationById(id);

    if (!res.success) {
      return NextResponse.json(res, { status: 404 });
    }

    return NextResponse.json(res, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/registrations/[id]
 * Update participant details, physical form number, or replace documents
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const res = await updateRegistration(id, body);

    if (!res.success) {
      const statusCode = res.error?.includes('already assigned') ? 409 : 400;
      return NextResponse.json(res, { status: statusCode });
    }

    return NextResponse.json(res, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
