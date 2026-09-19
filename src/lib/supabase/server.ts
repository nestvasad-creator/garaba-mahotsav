import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  let cookieStore: any = null;
  try {
    cookieStore = await cookies();
  } catch {
    // Gracefully handle when cookies() is called outside an active request scope
    // (e.g. during static build prerendering, background workers, or scripts)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        try {
          return cookieStore ? cookieStore.getAll() : [];
        } catch {
          return [];
        }
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, any> }>) {
        try {
          if (cookieStore) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          }
        } catch {
          // The `setAll` method was called from a Server Component or outside request scope.
          // This can be safely ignored.
        }
      },
    },
  });
}
