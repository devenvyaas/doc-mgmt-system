export function getSanitizedSupabaseConfig() {
  let url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  let anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  let serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  // Strip wrapping quotes if user accidentally added quotes in .env.local
  url = url.replace(/^["']|["']$/g, '');
  anonKey = anonKey.replace(/^["']|["']$/g, '');
  serviceKey = serviceKey.replace(/^["']|["']$/g, '');

  // Strip any accidental subpaths (e.g., /auth/v1, /rest/v1, /dashboard/...)
  url = url.replace(/\/(auth|rest|storage|functions)\/v\d.*$/i, '');
  url = url.replace(/\/+$/, '');

  return {
    url,
    anonKey,
    serviceKey,
  };
}
