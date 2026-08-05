import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const MAX_SIZE_FREE = 10 * 1024 * 1024; // 10 MB
const MAX_SIZE_PRO = 100 * 1024 * 1024; // 100 MB
const MAX_DOCS_FREE = 5;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Authenticate User
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch User Profile for Subscription Tier
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const isPro = profile.subscription_tier === 'pro';

    // 3. Parse Form Data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const description = (formData.get('description') as string | null) || '';
    const category = (formData.get('category') as string | null) || 'General';

    if (!file || !title) {
      return NextResponse.json(
        { error: 'File and title are required' },
        { status: 400 }
      );
    }

    // 4. Validate File Type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, DOCX, and images (JPEG, PNG, WEBP, GIF) are allowed.' },
        { status: 400 }
      );
    }

    // 5. Validate File Size
    const maxSize = isPro ? MAX_SIZE_PRO : MAX_SIZE_FREE;
    if (file.size > maxSize) {
      const maxMb = isPro ? 100 : 10;
      return NextResponse.json(
        { error: `File size exceeds your ${profile.subscription_tier.toUpperCase()} plan limit of ${maxMb} MB.` },
        { status: 400 }
      );
    }

    // 6. Validate Upload Count Limit for Free Tier
    if (!isPro) {
      const { count, error: countError } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('uploaded_by', user.id);

      if (countError) {
        return NextResponse.json({ error: 'Failed to verify upload limit' }, { status: 500 });
      }

      if (count !== null && count >= MAX_DOCS_FREE) {
        return NextResponse.json(
          {
            error: `Free Plan upload limit reached (${MAX_DOCS_FREE}/${MAX_DOCS_FREE} documents). Please upgrade to Pro for unlimited uploads.`,
          },
          { status: 403 }
        );
      }
    }

    // 7. Upload to Supabase Storage
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${user.id}/${timestamp}_${sanitizedFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 8. Insert Metadata Record into Supabase Database
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        title,
        description,
        category,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      // Cleanup storage if database insert fails
      await supabase.storage.from('documents').remove([filePath]);
      return NextResponse.json(
        { error: `Database record creation failed: ${dbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during upload';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
