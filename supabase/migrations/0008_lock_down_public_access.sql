-- Lock the database down to the server.
--
-- The app talks to Supabase only from the server, with the service-role key
-- (src/lib/supabase/admin.ts). Earlier migrations granted the public `anon` key
-- access to every admin function and added anon read policies (including on
-- reservations, which hold buyer email, phone and NIC). This migration removes
-- all of that, so only service_role can read or change data.
--
-- Safe to run more than once. Run in the Supabase SQL editor.

-- ── Functions: only service_role may execute ──────────────────────────────────
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.prokind = 'f'
       -- skip functions that belong to extensions (e.g. pgcrypto)
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.signature);
  END LOOP;
END $$;

-- Functions created later don't become callable by anon/authenticated by default.
-- "Everyone may execute new functions" is a database-wide default, so it must be
-- revoked without IN SCHEMA; Supabase's anon/authenticated grants are per schema.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- ── Tables: drop every policy that lets anon/authenticated in ────────────────
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND roles && ARRAY['anon', 'authenticated', 'public']::name[]
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- RLS on every table (scan_logs and settings were missing it). With no policies,
-- anon/authenticated see nothing; service_role bypasses RLS.
ALTER TABLE events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings          ENABLE ROW LEVEL SECURITY;

-- Belt and braces: no direct table privileges for the public roles either.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
