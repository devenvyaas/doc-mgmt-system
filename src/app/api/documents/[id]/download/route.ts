import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  let docId = '';

  try {
    const { id } = await params;
    docId = id;
    const route = `/api/documents/${id}/download`;
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

    // 2. Fetch User Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    // 3. Fetch Document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      logger.error({ method: 'GET', route, status: 404, durationMs: Date.now() - startTime, error: 'Document not found' });
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // 4. Verify Authorization
    if (doc.uploaded_by !== user.id && !isAdmin) {
      const errMsg = 'Forbidden: You do not have permission to download this document';
      logger.error({ method: 'GET', route, status: 403, durationMs: Date.now() - startTime, error: errMsg });
      return NextResponse.json({ error: errMsg }, { status: 403 });
    }

    // 5. Generate Signed Download URL (valid for 60 seconds)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 60, {
        download: true,
      });

    if (signedUrlError || !signedUrlData) {
      logger.error({ method: 'GET', route, status: 500, durationMs: Date.now() - startTime, error: 'Failed to generate download URL' });
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      );
    }

    logger.info({
      method: 'GET',
      route,
      status: 200,
      durationMs: Date.now() - startTime,
      details: { documentId: id, title: doc.title },
    });

    return NextResponse.json({ downloadUrl: signedUrlData.signedUrl });
  } catch (err) {
    const route = `/api/documents/${docId || 'unknown'}/download`;
    const errorMessage = err instanceof Error ? err.message : 'Failed to process download request';
    logger.error({ method: 'GET', route, status: 500, durationMs: Date.now() - startTime, error: err instanceof Error ? err : errorMessage });
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
