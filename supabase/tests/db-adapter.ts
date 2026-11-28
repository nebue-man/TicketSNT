// The in-memory Postgres adapter for src/lib/data/db-adapter.ts (ADR-0006): runs
// a database function in PGlite, with every migration applied, as service_role
// (the role the server's key uses), and answers the way supabase-js `rpc()`
// does: rows for a set-returning function, the value for a scalar one, null for
// void, and `{ message }` for a raised error.
import type { PGlite } from '@electric-sql/pglite'
import type { DbAdapter } from '@/lib/data/db-adapter'

const IDENT = /^[a-z_][a-z0-9_]*$/
// PostgREST sends numeric as a JSON number; PGlite would give a string.
const NUMERIC_OID = 1700
const AS_JSON = { parsers: { [NUMERIC_OID]: (v: string) => Number(v) } }

export function pgliteAdapter(getDb: () => PGlite): DbAdapter {
  return {
    async run(fn, args) {
      const db = getDb()
      const names = Object.keys(args)
      for (const n of [fn, ...names]) if (!IDENT.test(n)) throw new Error(`Bad identifier: ${n}`)
      // supabase-js sends JSON: objects and arrays arrive as jsonb.
      const params = names.map(n => {
        const v = args[n]
        return v !== null && typeof v === 'object' ? JSON.stringify(v) : v
      })
      const call = `${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')})`

      const { rows: [shape] } = await db.query<{ retset: boolean; typtype: string; typname: string }>(
        `SELECT p.proretset AS retset, t.typtype, t.typname
           FROM pg_proc p JOIN pg_type t ON t.oid = p.prorettype
          WHERE p.proname = $1 LIMIT 1`, [fn])

      await db.exec('SET ROLE service_role')
      try {
        let data: unknown
        if (!shape) {
          throw new Error(`function ${fn} does not exist`)
        } else if (shape.retset) {
          data = (await db.query(`SELECT * FROM ${call}`, params, AS_JSON)).rows
        } else if (shape.typname === 'void') {
          await db.query(`SELECT ${call}`, params)
          data = null
        } else {
          data = (await db.query<{ v: unknown }>(`SELECT ${call} AS v`, params, AS_JSON)).rows[0]?.v ?? null
        }
        // Over HTTP, timestamps arrive as strings: match that.
        return { data: JSON.parse(JSON.stringify(data)), error: null }
      } catch (err) {
        return { data: null, error: { message: (err as Error).message } }
      } finally {
        await db.exec('RESET ROLE')
      }
    },
  }
}
