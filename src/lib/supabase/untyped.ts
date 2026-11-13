// Untyped Supabase client for data-layer queries until generated types replace the hand-written Database type.
// All callers are responsible for narrowing the returned data themselves.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createUntypedClient(): Promise<ReturnType<typeof createServerClient<any>>> {
  const cookieStore = await cookies()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )
}
