import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/data/supabase';
import { useAuth } from '@/features/auth/session';

export interface MyProfile {
  id: string;
  handle: string;
  display_name: string;
  avatar_path: string | null;
  timezone: string;
  timezone_confirmed: boolean;
  week_starts_on: number;
  visibility: 'private' | 'friends' | 'public';
}

export function useMyProfile() {
  const userId = useAuth((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId && !!supabase,
    queryFn: async (): Promise<MyProfile> => {
      const { data, error } = await supabase!
        .from('profiles')
        .select('id, handle, display_name, avatar_path, timezone, timezone_confirmed, week_starts_on, visibility')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data as MyProfile;
    },
  });
}
