import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function PATCH(
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
      logger.error({ method: 'PATCH', route, status: 401, durationMs: Date.now() - startTime, error: 'Unauthorized' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch User Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    // 3. Fetch Existing Document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      logger.error({ method: 'PATCH', route, status: 404, durationMs: Date.now() - startTime, error: 'Document not found' });
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // 4. Verify Ownership or Admin Permission
    if (doc.uploaded_by !== user.id && !isAdmin) {
      const errMsg = 'Forbidden: You do not have permission to update this document';
      logger.error({ method: 'PATCH', route, status: 403, durationMs: Date.now() - startTime, error: errMsg });
      return NextResponse.json({ error: errMsg }, { status: 403 });
    }

    // 5. Parse Request Body
    const body = await request.json();
    const { title, description, category } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      logger.error({ method: 'PATCH', route, status: 400, durationMs: Date.now() - startTime, error: 'Title is required' });
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // 6. Update Metadata in Database
    const { data: updatedDoc, error: updateError } = await supabase
      .from('documents')
      .update({
        title: title.trim(),
        description: description ? description.trim() : null,
        category: category ? category.trim() : 'General',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error({ method: 'PATCH', route, status: 500, durationMs: Date.now() - startTime, error: `Database update failed: ${updateError.message}` });
      return NextResponse.json({ error: `Database update failed: ${updateError.message}` }, { status: 500 });
    }

    logger.info({
      method: 'PATCH',
      route,
      status: 200,
      durationMs: Date.now() - startTime,
      details: { documentId: id, updatedTitle: updatedDoc.title },
    });

    return NextResponse.json({ success: true, document: updatedDoc });
  } catch (err) {
    const route = `/api/documents/${docId || 'unknown'}`;
    const errorMessage = err instanceof Error ? err.message : 'Failed to update document details';
    logger.error({ method: 'PATCH', route, status: 500, durationMs: Date.now() - startTime, error: err instanceof Error ? err : errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

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
