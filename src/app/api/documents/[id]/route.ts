import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 1. Authenticate User
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // 4. Verify Ownership or Admin Permission
    if (doc.uploaded_by !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to delete this document' },
        { status: 403 }
      );
    }

    // 5. Remove from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([doc.file_path]);

    if (storageError) {
      console.error('Storage deletion warning:', storageError.message);
    }

    // 6. Delete from Supabase Database
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (dbError) {
      return NextResponse.json(
        { error: `Database deletion failed: ${dbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Document deleted successfully' });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete document';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
