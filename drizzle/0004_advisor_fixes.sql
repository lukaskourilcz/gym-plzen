-- Supabase security advisor remediation applied on 2026-07-27.
-- 1) Move btree_gist extension out of the public schema (extension_in_public WARN).
-- 2) Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated so they
--    cannot be called via PostgREST /rpc/*.

ALTER EXTENSION btree_gist SET SCHEMA extensions;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_availability_signal() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, PUBLIC;
