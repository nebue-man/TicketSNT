import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The seam under callDb (ADR-0006): runs one database function. Supabase in
 * production; tests swap this module for the in-memory Postgres adapter in
 * supabase/tests/db-adapter.ts.
 */
export interface DbAdapter {
  run(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>
}

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>

export const dbAdapter: DbAdapter = {
  async run(fn, args) {
    const client = createAdminClient() as unknown as { rpc: Rpc }
    const { data, error } = await client.rpc(fn, args)
    return { data, error: error ? { message: error.message ?? 'unknown error' } : null }
  },
}
