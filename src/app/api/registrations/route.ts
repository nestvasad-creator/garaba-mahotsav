import { NextRequest, NextResponse } from 'next/server';
import { createRegistration, getRegistrationsPaginated } from '@/lib/registrations/actions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/registrations
 * Query registrations directly from database with search and status filtering & pagination
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('event_id') || undefined;
    const search = searchParams.get('search') || searchParams.get('q') || '';
    const status = searchParams.get('status') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10)));

    const result = await getRegistrationsPaginated({
      eventId,
      search,
      status,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      count: result.count,
      totalCount: result.count,
      totalPages: result.totalPages,
      page: result.page,
      limit: result.limit,
    });
  } catch (err: any) {
    console.error('GET /api/registrations error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch registrations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/registrations
 * Endpoint for DEO registration enrollment with photo, Aadhaar, and physical form attachments
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.physical_form_number?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Physical Paper Form Serial Number is mandatory.' },
        { status: 400 }
      );
    }

    if (!body.full_name_en?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Full Name as per Aadhaar Card is required.' },
        { status: 400 }
      );
    }

    if (!body.mobile || body.mobile.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'A valid 10-digit mobile number is required.' },
        { status: 400 }
      );
    }

    const result = await createRegistration(body);

    if (!result.success) {
      const statusCode = result.error?.includes('already been registered') ? 409 : 400;
      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/registrations error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
