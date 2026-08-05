import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  let docId = '';

  try {
    const { id } = await params;
    docId = id;
    const route = `/api/documents/${id}`;
    const supabase = await createClient();

    // 1. Authenticate User
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.error({ method: 'DELETE', route, status: 401, durationMs: Date.now() - startTime, error: 'Unauthorized' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch User Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    // 3. Fetch Document Details
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      logger.error({ method: 'DELETE', route, status: 404, durationMs: Date.now() - startTime, error: 'Document not found' });
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // 4. Verify Ownership or Admin Permission
    if (doc.uploaded_by !== user.id && !isAdmin) {
      const errMsg = 'Forbidden: You do not have permission to delete this document';
      logger.error({ method: 'DELETE', route, status: 403, durationMs: Date.now() - startTime, error: errMsg });
      return NextResponse.json({ error: errMsg }, { status: 403 });
    }

    // 5. Remove from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([doc.file_path]);

    if (storageError) {
      logger.error({ method: 'DELETE', route, status: 500, durationMs: Date.now() - startTime, error: `Storage deletion failed: ${storageError.message}` });
    }

    // 6. Delete from Supabase Database
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (dbError) {
      logger.error({ method: 'DELETE', route, status: 500, durationMs: Date.now() - startTime, error: `Database deletion failed: ${dbError.message}` });
      return NextResponse.json(
        { error: `Database deletion failed: ${dbError.message}` },
        { status: 500 }
      );
    }

    logger.info({
      method: 'DELETE',
      route,
      status: 200,
      durationMs: Date.now() - startTime,
      details: { documentId: id, title: doc.title },
    });

    return NextResponse.json({ success: true, message: 'Document deleted successfully' });
  } catch (err) {
    const route = `/api/documents/${docId || 'unknown'}`;
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete document';
    logger.error({ method: 'DELETE', route, status: 500, durationMs: Date.now() - startTime, error: err instanceof Error ? err : errorMessage });
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
