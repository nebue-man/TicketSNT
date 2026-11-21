import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Server-only. Uses the service role key which bypasses RLS.
 * Never import this from a 'use client' component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, '')
  return createSupabaseClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
