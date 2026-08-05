import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

function getDownloadFilename(title: string, filePath: string): string {
  const extMatch = filePath.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : '';
  const cleanTitle = title.trim();
  if (ext && !cleanTitle.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    return `${cleanTitle}.${ext}`;
  }
  return cleanTitle;
}

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
    const mode = request.nextUrl.searchParams.get('mode') || 'download';
    const isViewMode = mode === 'view';

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
      const errMsg = 'Forbidden: You do not have permission to access this document';
      logger.error({ method: 'GET', route, status: 403, durationMs: Date.now() - startTime, error: errMsg });
      return NextResponse.json({ error: errMsg }, { status: 403 });
    }

    // 5. Generate Signed URL with exact DB title filename for downloads
    const downloadParam = isViewMode ? false : getDownloadFilename(doc.title, doc.file_path);

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 60, {
        download: downloadParam,
      });

    if (signedUrlError || !signedUrlData) {
      logger.error({ method: 'GET', route, status: 500, durationMs: Date.now() - startTime, error: 'Failed to generate signed URL' });
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: 500 }
      );
    }

    logger.info({
      method: 'GET',
      route,
      status: 200,
      durationMs: Date.now() - startTime,
      details: { documentId: id, title: doc.title, mode, downloadFilename: downloadParam },
    });

    return NextResponse.json({ downloadUrl: signedUrlData.signedUrl, mode });
  } catch (err) {
    const route = `/api/documents/${docId || 'unknown'}/download`;
    const errorMessage = err instanceof Error ? err.message : 'Failed to process request';
    logger.error({ method: 'GET', route, status: 500, durationMs: Date.now() - startTime, error: err instanceof Error ? err : errorMessage });
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
