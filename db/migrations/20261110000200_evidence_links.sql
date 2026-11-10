-- migrate:up
ALTER TABLE contract_documents ADD CONSTRAINT contract_documents_copy_contract_fk
  FOREIGN KEY (copy_of_id, contract_id) REFERENCES contract_documents(id, contract_id);
-- Guard stable evidence fields while reserving lifecycle writes for feature functions.
CREATE FUNCTION guard_evidence_links() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE vehicle uuid;
BEGIN
  IF TG_TABLE_NAME = 'damages' THEN
    IF TG_OP = 'UPDATE' AND
       (to_jsonb(NEW) - ARRAY['status','repaired_in_maintenance_id','repaired_on','estimate_amount','estimate_mode'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','repaired_in_maintenance_id','repaired_on','estimate_amount','estimate_mode']) THEN
      RAISE EXCEPTION 'damage description is immutable' USING ERRCODE = '55000';
    END IF;
    IF NEW.estimate_amount IS NOT NULL AND
       (TG_OP = 'INSERT' OR NEW.estimate_amount IS DISTINCT FROM OLD.estimate_amount OR NEW.estimate_mode IS DISTINCT FROM OLD.estimate_mode) AND
       NOT EXISTS (SELECT FROM public.inspections WHERE id = NEW.found_in_inspection_id AND status = 'in_progress') THEN
      RAISE EXCEPTION 'estimate requires an unsigned return' USING ERRCODE = '55000';
    END IF;
  ELSIF TG_TABLE_NAME = 'stored_signatures' THEN
    IF TG_OP = 'UPDATE' AND
       (to_jsonb(NEW) - ARRAY['status','applied_at','applied_by','cancelled_at','cancelled_by','cancel_reason'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','applied_at','applied_by','cancelled_at','cancelled_by','cancel_reason']) THEN
      RAISE EXCEPTION 'stored drawing is immutable' USING ERRCODE = '55000';
    END IF;
    IF NOT EXISTS (SELECT FROM public.contract_documents WHERE id = NEW.authorisation_pdf_id AND stage = 'authorisation' AND terms_version_id = NEW.authorisation_version_id) OR
       NOT EXISTS (SELECT FROM public.terms_versions WHERE id = NEW.authorisation_version_id AND kind = 'return_authorisation') THEN
      RAISE EXCEPTION 'authorisation evidence mismatch' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'inspections' THEN
    SELECT vehicle_id INTO vehicle FROM public.contracts WHERE id = NEW.contract_id;
    IF NEW.baseline_id IS NOT NULL AND NOT EXISTS (SELECT FROM public.condition_baselines WHERE id = NEW.baseline_id AND vehicle_id = vehicle) THEN
      RAISE EXCEPTION 'baseline vehicle mismatch' USING ERRCODE = '23514';
    END IF;
    IF array_position(NEW.open_damage_ids, NULL) IS NOT NULL OR EXISTS (
      SELECT FROM unnest(NEW.open_damage_ids) d(id) WHERE NOT EXISTS
      (SELECT FROM public.damages WHERE id = d.id AND vehicle_id = vehicle)
    ) THEN RAISE EXCEPTION 'damage snapshot vehicle mismatch' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'signatures' THEN
    IF NOT EXISTS (SELECT FROM public.contract_documents WHERE id = NEW.preview_id AND stage = 'preview' AND sha256 = NEW.preview_sha256 AND revision_no = NEW.revision_no) OR
       NOT EXISTS (SELECT FROM public.contract_documents WHERE id = NEW.sealed_pdf_id AND stage = CASE NEW.stage WHEN 'departure' THEN 'departure' ELSE 'final' END AND sha256 = NEW.sealed_pdf_sha256 AND revision_no = NEW.revision_no) THEN
      RAISE EXCEPTION 'signature document mismatch' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT FROM unnest(NEW.terms_version_ids) t(id) WHERE NOT EXISTS (SELECT FROM public.terms_versions WHERE id = t.id)) THEN
      RAISE EXCEPTION 'unknown signature terms version' USING ERRCODE = '23503';
    END IF;
  ELSIF TG_TABLE_NAME = 'contract_revisions' THEN
    IF (NEW.terms_version_fr_id IS NOT NULL AND NOT EXISTS (SELECT FROM public.terms_versions WHERE id = NEW.terms_version_fr_id AND language = 'fr' AND kind = 'general_terms')) OR
       (NEW.terms_version_en_id IS NOT NULL AND NOT EXISTS (SELECT FROM public.terms_versions WHERE id = NEW.terms_version_en_id AND language = 'en' AND kind = 'general_terms')) THEN
      RAISE EXCEPTION 'revision terms language or kind mismatch' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'contract_documents' THEN
    IF NOT EXISTS (SELECT FROM public.terms_versions WHERE id = NEW.terms_version_id AND language = NEW.language AND kind = CASE WHEN NEW.stage = 'authorisation' THEN 'return_authorisation' ELSE 'general_terms' END) THEN
      RAISE EXCEPTION 'document terms mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION guard_evidence_links() FROM PUBLIC;
CREATE TRIGGER damages_links BEFORE INSERT OR UPDATE ON damages FOR EACH ROW EXECUTE FUNCTION guard_evidence_links();
CREATE TRIGGER stored_signatures_links BEFORE INSERT OR UPDATE ON stored_signatures FOR EACH ROW EXECUTE FUNCTION guard_evidence_links();
CREATE TRIGGER inspections_links BEFORE INSERT OR UPDATE ON inspections FOR EACH ROW EXECUTE FUNCTION guard_evidence_links();
CREATE TRIGGER signatures_links BEFORE INSERT ON signatures FOR EACH ROW EXECUTE FUNCTION guard_evidence_links();
CREATE TRIGGER contract_revisions_links BEFORE INSERT OR UPDATE ON contract_revisions FOR EACH ROW EXECUTE FUNCTION guard_evidence_links();
CREATE TRIGGER contract_documents_links BEFORE INSERT ON contract_documents FOR EACH ROW EXECUTE FUNCTION guard_evidence_links();
CREATE TRIGGER damages_no_delete BEFORE DELETE OR TRUNCATE ON damages FOR EACH STATEMENT EXECUTE FUNCTION reject_evidence_mutation();
CREATE TRIGGER stored_signatures_no_delete BEFORE DELETE OR TRUNCATE ON stored_signatures FOR EACH STATEMENT EXECUTE FUNCTION reject_evidence_mutation();

-- migrate:down
ALTER TABLE contract_documents DROP CONSTRAINT contract_documents_copy_contract_fk;
DROP TRIGGER stored_signatures_no_delete ON stored_signatures;
DROP TRIGGER damages_no_delete ON damages;
DROP TRIGGER contract_documents_links ON contract_documents;
DROP TRIGGER contract_revisions_links ON contract_revisions;
DROP TRIGGER signatures_links ON signatures;
DROP TRIGGER inspections_links ON inspections;
DROP TRIGGER stored_signatures_links ON stored_signatures;
DROP TRIGGER damages_links ON damages;
DROP FUNCTION guard_evidence_links();
