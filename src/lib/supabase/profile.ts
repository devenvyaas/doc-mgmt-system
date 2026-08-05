import { SupabaseClient } from '@supabase/supabase-js';
import { Profile } from '@/lib/types';

export async function getOrEnsureProfile(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string,
  userMetadataName?: string
): Promise<Profile | null> {
  try {
    // 1. Fetch profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profile) {
      return profile as Profile;
    }

    if (error) {
      console.warn('Profile fetch error, attempting auto-upsert:', error.message);
    }

    // 2. Auto-heal missing profile row
    const fallbackName = userMetadataName || userEmail.split('@')[0];
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: userEmail,
          full_name: fallbackName,
          role: 'user',
          subscription_tier: 'free',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single();

    if (insertError) {
      console.error('Failed to auto-upsert missing profile:', insertError.message);
      return null;
    }

    return newProfile as Profile;
  } catch (err) {
    console.error('Unexpected error in getOrEnsureProfile:', err);
    return null;
  }
}
