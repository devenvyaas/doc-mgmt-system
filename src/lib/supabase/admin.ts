import { createClient } from '@supabase/supabase-js';
import { getSanitizedSupabaseConfig } from './config';

export function createAdminClient() {
  const { url, serviceKey } = getSanitizedSupabaseConfig();

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is missing.');
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
