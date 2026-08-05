import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const maxDuration = 60; // 60 seconds timeout for large file uploads up to 100MB

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
  const startTime = Date.now();
  const route = '/api/documents/upload';

  try {
    const supabase = await createClient();

    // 1. Authenticate User
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.error({ method: 'POST', route, status: 401, durationMs: Date.now() - startTime, error: 'Unauthorized' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch User Profile for Subscription Tier
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error({ method: 'POST', route, status: 404, durationMs: Date.now() - startTime, error: 'User profile not found' });
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const isPro = profile.subscription_tier === 'pro';

    // 3. Parse Form Data (Up to 100MB)
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseErr) {
      const parseMessage = parseErr instanceof Error ? parseErr.message : 'Failed to parse form data';
      logger.error({ method: 'POST', route, status: 400, durationMs: Date.now() - startTime, error: `Body parse error: ${parseMessage}` });
      return NextResponse.json(
        { error: 'File upload exceeds server limits or stream was interrupted. Please ensure file is within your plan limits.' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const description = (formData.get('description') as string | null) || '';
    const category = (formData.get('category') as string | null) || 'General';

    if (!file || !title) {
      logger.error({ method: 'POST', route, status: 400, durationMs: Date.now() - startTime, error: 'File and title are required' });
      return NextResponse.json(
        { error: 'File and title are required' },
        { status: 400 }
      );
    }

    // 4. Validate File Type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      const errMsg = 'Invalid file type. Only PDF, DOCX, and images (JPEG, PNG, WEBP, GIF) are allowed.';
      logger.error({ method: 'POST', route, status: 400, durationMs: Date.now() - startTime, error: errMsg });
      return NextResponse.json(
        { error: errMsg },
        { status: 400 }
      );
    }

    // 5. Validate File Size
    const maxSize = isPro ? MAX_SIZE_PRO : MAX_SIZE_FREE;
    if (file.size > maxSize) {
      const maxMb = isPro ? 100 : 10;
      const errMsg = `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds your ${profile.subscription_tier.toUpperCase()} plan limit of ${maxMb} MB.`;
      logger.error({ method: 'POST', route, status: 400, durationMs: Date.now() - startTime, error: errMsg });
      return NextResponse.json(
        { error: errMsg },
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
        logger.error({ method: 'POST', route, status: 500, durationMs: Date.now() - startTime, error: countError.message });
        return NextResponse.json({ error: 'Failed to verify upload limit' }, { status: 500 });
      }

      if (count !== null && count >= MAX_DOCS_FREE) {
        const errMsg = `Free Plan upload limit reached (${MAX_DOCS_FREE}/${MAX_DOCS_FREE} documents). Please upgrade to Pro for unlimited uploads.`;
        logger.error({ method: 'POST', route, status: 403, durationMs: Date.now() - startTime, error: errMsg });
        return NextResponse.json(
          { error: errMsg },
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
      logger.error({ method: 'POST', route, status: 500, durationMs: Date.now() - startTime, error: `Storage upload failed: ${uploadError.message}` });
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
      await supabase.storage.from('documents').remove([filePath]);
      logger.error({ method: 'POST', route, status: 500, durationMs: Date.now() - startTime, error: `Database record creation failed: ${dbError.message}` });
      return NextResponse.json(
        { error: `Database record creation failed: ${dbError.message}` },
        { status: 500 }
      );
    }

    logger.info({
      method: 'POST',
      route,
      status: 201,
      durationMs: Date.now() - startTime,
      details: { documentId: document.id, title: document.title, size: file.size },
    });

    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during upload';
    logger.error({ method: 'POST', route, status: 500, durationMs: Date.now() - startTime, error: err instanceof Error ? err : errorMessage });
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
