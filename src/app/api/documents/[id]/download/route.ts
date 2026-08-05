import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
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

    // 3. Fetch Document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // 4. Verify Authorization
    if (doc.uploaded_by !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to download this document' },
        { status: 403 }
      );
    }

    // 5. Generate Signed Download URL (valid for 60 seconds)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 60, {
        download: true,
      });

    if (signedUrlError || !signedUrlData) {
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({ downloadUrl: signedUrlData.signedUrl });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to process download request';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
