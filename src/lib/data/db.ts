import { dbAdapter } from './db-adapter'

/**
 * What a database function call came to (ADR-0006):
 * - ok: it answered, with its data (including answers like 'has_bookings').
 * - refused: it raised one of the codes the caller listed, as `code` or `code:detail`.
 * - failed: anything else. The database couldn't answer; callers must not show it as empty.
 */
export type DbResult<T, R extends string = never> =
  | { kind: 'ok'; data: T }
  | { kind: 'refused'; code: R; detail: string | null }
  | { kind: 'failed' }

/** Thrown by a page read whose database call failed; the admin error screen catches it. */
export class DbFailure extends Error {
  constructor(fn: string) {
    super(`Database call ${fn} failed`)
    this.name = 'DbFailure'
  }
}

/**
 * Calls one database function by name. `T` is the data the caller expects
 * (not checked at runtime). Each failure is logged once, naming the function.
 */
export async function callDb<T = unknown, R extends string = never>(
  fn: string,
  args: Record<string, unknown> = {},
  refusals: readonly R[] = [],
): Promise<DbResult<T, R>> {
  let answer: Awaited<ReturnType<typeof dbAdapter.run>>
  try {
    answer = await dbAdapter.run(fn, args)
  } catch (err) {
    console.error(`[db] ${fn} failed:`, (err as Error).message)
    return { kind: 'failed' }
  }
  if (!answer.error) return { kind: 'ok', data: answer.data as T }

  const message = answer.error.message
  const sep = message.indexOf(':')
  const code = sep === -1 ? message : message.slice(0, sep)
  if ((refusals as readonly string[]).includes(code)) {
    return { kind: 'refused', code: code as R, detail: sep === -1 ? null : message.slice(sep + 1).trim() || null }
  }
  console.error(`[db] ${fn} failed:`, message)
  return { kind: 'failed' }
}
