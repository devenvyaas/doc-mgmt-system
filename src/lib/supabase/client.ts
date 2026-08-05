import { createBrowserClient } from '@supabase/ssr';
import { getSanitizedSupabaseConfig } from './config';

export function createClient() {
  const { url, anonKey } = getSanitizedSupabaseConfig();
  return createBrowserClient(url, anonKey);
}
