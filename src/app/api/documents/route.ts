import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/documents';

  try {
    const supabase = await createClient();

    // 1. Authenticate User
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.error({ method: 'GET', route, status: 401, durationMs: Date.now() - startTime, error: 'Unauthorized' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Query Parameters for Server-side Search & Filtering
    const searchParams = request.nextUrl.searchParams;
    const search = (searchParams.get('search') || '').trim();
    const category = (searchParams.get('category') || 'All').trim();
    const isAdminView = searchParams.get('admin') === 'true';

    // 3. Check User Role if Admin View Requested
    if (isAdminView) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        logger.error({ method: 'GET', route, status: 403, durationMs: Date.now() - startTime, error: 'Forbidden: Admin view requested by non-admin' });
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // 4. Build Server Query with Filters
    let query = supabase.from('documents').select(isAdminView ? '*, profiles(email, full_name)' : '*');

    if (!isAdminView) {
      query = query.eq('uploaded_by', user.id);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    query = query.order('created_at', { ascending: false });

    const { data: documents, error: dbError } = await query;

    if (dbError) {
      logger.error({ method: 'GET', route, status: 500, durationMs: Date.now() - startTime, error: dbError.message });
      return NextResponse.json({ error: `Database error: ${dbError.message}` }, { status: 500 });
    }

    logger.info({
      method: 'GET',
      route,
      status: 200,
      durationMs: Date.now() - startTime,
      details: { count: documents?.length || 0, search, category, isAdminView },
    });

    return NextResponse.json({ documents: documents || [] });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch documents';
    logger.error({ method: 'GET', route, status: 500, durationMs: Date.now() - startTime, error: err instanceof Error ? err : errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
