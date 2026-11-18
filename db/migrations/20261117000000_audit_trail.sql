-- migrate:up
-- Ticket #9; US-007/012/015; ADR-0007/0012. Authentication-only writes are
-- deliberately actorless. Business writes and developer commands are not.
CREATE FUNCTION audit_actor() RETURNS uuid
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE actor uuid;
BEGIN
  BEGIN
    actor := NULLIF(current_setting('app.actor_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'staff actor required' USING ERRCODE = '22023';
  END;
  IF actor IS NULL OR NOT EXISTS (SELECT FROM public.staff_profiles WHERE id = actor) THEN
    RAISE EXCEPTION 'staff actor required' USING ERRCODE = '22023';
  END IF;
  RETURN actor;
END;
$$;

CREATE FUNCTION stamp_audit_event() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  NEW.created_at := clock_timestamp();
  NEW.created_by := public.audit_actor();
  NEW.actor_id := NEW.created_by;
  RETURN NEW;
END;
$$;
CREATE TRIGGER audit_events_stamp BEFORE INSERT ON audit_events
  FOR EACH ROW EXECUTE FUNCTION stamp_audit_event();

CREATE FUNCTION audit_business_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  actor uuid := public.audit_actor();
  before_row jsonb;
  after_row jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN before_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN after_row := to_jsonb(NEW); END IF;
  INSERT INTO public.audit_events(created_by, actor_id, action, table_name, row_id, before_values, after_values)
    VALUES (actor, actor, TG_OP, TG_TABLE_NAME,
      (COALESCE(after_row, before_row)->>'id')::uuid, before_row, after_row);
  RETURN NULL;
END;
$$;
-- Explicit cast keeps the reusable row trigger independent of a table's row type.
-- (All business primary keys are UUIDs.)
DO $$
DECLARE business_table record;
BEGIN
  FOR business_table IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relispartition
      AND c.relname NOT IN ('schema_migrations', 'audit_events',
        'auth_users', 'auth_accounts', 'auth_sessions', 'auth_verifications',
        'auth_two_factors', 'auth_flows', 'auth_rate_limits')
  LOOP
    EXECUTE format('CREATE TRIGGER business_mutation_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_business_mutation()', business_table.relname);
  END LOOP;
END;
$$;

-- Only the trusted developer command can write semantic account events. The
-- function accepts no arbitrary payload, so credential material cannot enter it.
CREATE FUNCTION write_staff_audit(p_action text, p_actor_id uuid, p_staff_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE actor uuid := public.audit_actor();
BEGIN
  IF p_actor_id IS DISTINCT FROM actor OR p_action IS NULL OR p_action NOT IN
    ('staff_created', 'staff_deactivated', 'staff_reactivated', 'staff_password_reset', 'staff_factor_reset') THEN
    RAISE EXCEPTION 'invalid staff audit event' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT FROM public.staff_profiles WHERE id = p_staff_id) THEN
    RAISE EXCEPTION 'staff profile required' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.audit_events(created_by, actor_id, action, table_name, row_id, after_values)
    VALUES (actor, actor, p_action, 'staff_profiles', p_staff_id,
      jsonb_build_object('action', p_action, 'staff_id', p_staff_id));
END;
$$;

-- Preserve previously recorded evidence; only newly supplied timestamps are
-- replaced with database time. Lifecycle functions will set completion markers.
CREATE FUNCTION server_signature_times() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  field text;
  fields text[];
  old_row jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  new_row jsonb := to_jsonb(NEW);
BEGIN
  fields := CASE TG_TABLE_NAME
    WHEN 'stored_signatures' THEN ARRAY['created_at', 'captured_at', 'applied_at', 'cancelled_at']
    WHEN 'signatures' THEN ARRAY['created_at', 'signed_at']
    ELSE ARRAY['signed_at'] END;
  FOREACH field IN ARRAY fields LOOP
    IF old_row->>field IS NOT NULL THEN
      IF new_row->field IS DISTINCT FROM old_row->field THEN
        RAISE EXCEPTION 'signature timestamp is immutable' USING ERRCODE = '55000';
      END IF;
    ELSIF new_row->>field IS NOT NULL OR
      (TG_OP = 'INSERT' AND (TG_TABLE_NAME = 'signatures' OR field IN ('created_at', 'captured_at'))) THEN
      new_row := jsonb_set(new_row, ARRAY[field], to_jsonb(clock_timestamp()));
    END IF;
  END LOOP;
  NEW := jsonb_populate_record(NEW, new_row);
  RETURN NEW;
END;
$$;
CREATE TRIGGER signatures_server_time BEFORE INSERT ON signatures
  FOR EACH ROW EXECUTE FUNCTION server_signature_times();
CREATE TRIGGER stored_signatures_server_time BEFORE INSERT OR UPDATE ON stored_signatures
  FOR EACH ROW EXECUTE FUNCTION server_signature_times();
CREATE TRIGGER contract_revisions_server_time BEFORE INSERT OR UPDATE ON contract_revisions
  FOR EACH ROW EXECUTE FUNCTION server_signature_times();

REVOKE ALL ON FUNCTION audit_actor(), stamp_audit_event(), audit_business_mutation(),
  write_staff_audit(text, uuid, uuid), server_signature_times() FROM PUBLIC, mcr_api;
-- Table-level REVOKE alone does not remove the original column-level grant.
REVOKE INSERT (id, created_at, created_by, actor_id, action, table_name, row_id, before_values, after_values)
  ON audit_events FROM mcr_api;
REVOKE INSERT ON audit_events FROM mcr_api;
-- Number allocation is private; future preview/signing functions compose it.
REVOKE EXECUTE ON FUNCTION reserve_contract_number(uuid, integer, uuid), confirm_contract_number(uuid, varchar) FROM mcr_api;

-- migrate:down
GRANT EXECUTE ON FUNCTION reserve_contract_number(uuid, integer, uuid), confirm_contract_number(uuid, varchar) TO mcr_api;
GRANT INSERT (id, created_at, created_by, actor_id, action, table_name, row_id, before_values, after_values) ON audit_events TO mcr_api;
DROP TRIGGER contract_revisions_server_time ON contract_revisions;
DROP TRIGGER stored_signatures_server_time ON stored_signatures;
DROP TRIGGER signatures_server_time ON signatures;
DROP FUNCTION server_signature_times();
DROP FUNCTION write_staff_audit(text, uuid, uuid);
DO $$
DECLARE business_table record;
BEGIN
  FOR business_table IN
    SELECT c.relname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND t.tgname = 'business_mutation_audit'
  LOOP
    EXECUTE format('DROP TRIGGER business_mutation_audit ON public.%I', business_table.relname);
  END LOOP;
END;
$$;
DROP FUNCTION audit_business_mutation();
DROP TRIGGER audit_events_stamp ON audit_events;
DROP FUNCTION stamp_audit_event();
DROP FUNCTION audit_actor();
