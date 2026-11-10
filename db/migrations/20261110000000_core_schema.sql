-- migrate:up
-- US-006 part 1; ADR-0006/0007/0011/0019/0022/0023/0024.
-- The migration owner is deliberately different from the runtime login.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
-- mcr_api is provisioned by the administrator, without owner membership.
GRANT USAGE ON SCHEMA public TO mcr_api;

CREATE TABLE staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  display_name varchar(80) NOT NULL,
  auth_user_id varchar(128) UNIQUE
  
);

CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  plate varchar(20) NOT NULL CHECK (plate = upper(plate)),
  make_model varchar(80) NOT NULL,
  colour varchar(80),
  fuel_type varchar(32) NOT NULL DEFAULT 'unleaded_95' CHECK (fuel_type IN ('unleaded_95', 'unleaded_98', 'diesel', 'electric', 'hybrid', 'lpg', 'other')),
  current_km integer CHECK (current_km >= 0) NOT NULL DEFAULT 0,
  current_fuel integer CHECK (current_fuel BETWEEN 0 AND 8),
  status varchar(32) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'rented', 'maintenance', 'archived')),
  current_baseline_id uuid,
  notes varchar(500)
  
);

CREATE UNIQUE INDEX vehicles_normalized_plate ON vehicles (regexp_replace(plate, '[ -]', '', 'g'));

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  title varchar(32) CHECK (title IN ('m', 'mme')),
  first_name varchar(80),
  last_name varchar(80) NOT NULL,
  email varchar(254),
  phone varchar(40),
  street varchar(80),
  line2 varchar(80),
  postcode varchar(80),
  city varchar(80),
  state_region varchar(80),
  country varchar(80),
  local_address varchar(80),
  local_phone varchar(40),
  birth_date date,
  birth_place_or_country varchar(80),
  id_doc_type varchar(32) CHECK (id_doc_type IN ('passport', 'id_card')),
  id_doc_number varchar(80),
  id_doc_country varchar(80),
  id_doc_issued_on date,
  id_doc_expires_on date,
  licence_number varchar(80),
  licence_issued_on date,
  licence_expires_on date
  
);

CREATE TABLE condition_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  reason varchar(32) NOT NULL CHECK (reason IN ('initial', 'after_repair', 'manual')),
  taken_at timestamptz NOT NULL,
  taken_by uuid NOT NULL REFERENCES staff_profiles(id),
  UNIQUE (id, vehicle_id)
);

ALTER TABLE vehicles ADD FOREIGN KEY (current_baseline_id, id) REFERENCES condition_baselines(id, vehicle_id);

CREATE TABLE maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  kind varchar(32) NOT NULL CHECK (kind IN ('routine', 'damage_repair', 'other')),
  description varchar(500) NOT NULL,
  started_on date NOT NULL,
  finished_on date,
  odometer_km integer CHECK (odometer_km >= 0),
  CHECK (finished_on >= started_on), UNIQUE (id, vehicle_id)
);

CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  number varchar(13) UNIQUE CHECK (number ~ '^MCR-[0-9]{4}-[0-9]{4}$'),
  number_reserved_at timestamptz,
  number_confirmed_at timestamptz,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  status varchar(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'awaiting_signature', 'active', 'closed', 'void')),
  current_revision_no integer NOT NULL DEFAULT 1 CHECK (current_revision_no > 0),
  void_reason varchar(500),
  CHECK ((number IS NULL) = (number_reserved_at IS NULL)),
  CHECK (number_confirmed_at IS NULL OR number IS NOT NULL), UNIQUE (id, vehicle_id)
);

CREATE UNIQUE INDEX contracts_one_active_vehicle ON contracts(vehicle_id) WHERE status = 'active';

CREATE TABLE terms_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  kind varchar(32) NOT NULL CHECK (kind IN ('general_terms', 'return_authorisation')),
  language varchar(32) NOT NULL CHECK (language IN ('fr', 'en')),
  version_label varchar(80) NOT NULL,
  effective_from date NOT NULL,
  body_pages text[] NOT NULL CHECK (cardinality(body_pages) BETWEEN 1 AND 20 AND array_position(body_pages, NULL) IS NULL AND length(array_to_string(body_pages, '')) <= 200000),
  UNIQUE (kind, language, version_label)
);

CREATE TABLE contract_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  contract_id uuid NOT NULL REFERENCES contracts(id),
  revision_no integer NOT NULL CHECK (revision_no > 0),
  kind varchar(32) NOT NULL CHECK (kind IN ('departure', 'amendment')),
  terms_version_fr_id uuid REFERENCES terms_versions(id),
  terms_version_en_id uuid REFERENCES terms_versions(id),
  snapshot_sha256 varchar(64) CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  reason varchar(500),
  signed_at timestamptz,
  renter_title varchar(32) CHECK (renter_title IN ('m', 'mme')),
  renter_first_name varchar(80),
  renter_last_name varchar(80),
  renter_email varchar(254),
  renter_phone varchar(40),
  renter_street varchar(80),
  renter_line2 varchar(80),
  renter_postcode varchar(80),
  renter_city varchar(80),
  renter_state_region varchar(80),
  renter_country varchar(80),
  renter_local_address varchar(80),
  renter_local_phone varchar(40),
  renter_birth_date date,
  renter_birth_place_or_country varchar(80),
  renter_id_doc_type varchar(32) CHECK (renter_id_doc_type IN ('passport', 'id_card')),
  renter_id_doc_number varchar(80),
  renter_id_doc_country varchar(80),
  renter_id_doc_issued_on date,
  renter_id_doc_expires_on date,
  renter_licence_number varchar(80),
  renter_licence_issued_on date,
  renter_licence_expires_on date,
  additional_title varchar(32) CHECK (additional_title IN ('m', 'mme')),
  additional_first_name varchar(80),
  additional_last_name varchar(80),
  additional_email varchar(254),
  additional_phone varchar(40),
  additional_street varchar(80),
  additional_line2 varchar(80),
  additional_postcode varchar(80),
  additional_city varchar(80),
  additional_state_region varchar(80),
  additional_country varchar(80),
  additional_local_address varchar(80),
  additional_local_phone varchar(40),
  additional_birth_date date,
  additional_birth_place_or_country varchar(80),
  additional_id_doc_type varchar(32) CHECK (additional_id_doc_type IN ('passport', 'id_card')),
  additional_id_doc_number varchar(80),
  additional_id_doc_country varchar(80),
  additional_id_doc_issued_on date,
  additional_id_doc_expires_on date,
  additional_licence_number varchar(80),
  additional_licence_issued_on date,
  additional_licence_expires_on date,
  vehicle_plate varchar(20),
  vehicle_make_model varchar(80),
  vehicle_colour varchar(80),
  vehicle_fuel_type varchar(32) CHECK (vehicle_fuel_type IN ('unleaded_95', 'unleaded_98', 'diesel', 'electric', 'hybrid', 'lpg', 'other')),
  pickup_place varchar(80),
  return_place varchar(80),
  departure_at timestamptz,
  planned_return timestamptz,
  rental_days integer CHECK (rental_days >= 0),
  flight_train varchar(80),
  additional_info varchar(500),
  intermediary varchar(80),
  intermediary_phone varchar(40),
  departure_agent varchar(80),
  rate_1_3 numeric(10,2) CHECK (rate_1_3 >= 0),
  rate_4_7 numeric(10,2) CHECK (rate_4_7 >= 0),
  rate_extra_day_1 numeric(10,2) CHECK (rate_extra_day_1 >= 0),
  rate_extra_day_2 numeric(10,2) CHECK (rate_extra_day_2 >= 0),
  rate_package_price numeric(10,2) CHECK (rate_package_price >= 0),
  rate_extra_km numeric(10,2) CHECK (rate_extra_km >= 0),
  rate_package_days integer CHECK (rate_package_days >= 0),
  rate_km_included integer CHECK (rate_km_included >= 0),
  deductible_theft numeric(10,2) CHECK (deductible_theft >= 0),
  deductible_accident numeric(10,2) CHECK (deductible_accident >= 0),
  deposit numeric(10,2) CHECK (deposit >= 0),
  card_brand varchar(32) CHECK (card_brand IN ('visa', 'amex', 'other')),
  payment_method varchar(32) CHECK (payment_method IN ('cash', 'card')),
  card_last4 varchar(4) CHECK (card_last4 ~ '^[0-9]{4}$'),
  card_expiry varchar(5) CHECK (card_expiry ~ '^(0[1-9]|1[0-2])/[0-9]{2}$'),
  pricing_rental numeric(10,2) CHECK (pricing_rental >= 0),
  pricing_extra_days numeric(10,2) CHECK (pricing_extra_days >= 0),
  pricing_extra_km numeric(10,2) CHECK (pricing_extra_km >= 0),
  pricing_rental_total_ht numeric(10,2) CHECK (pricing_rental_total_ht >= 0),
  pricing_under_25_insurance numeric(10,2) CHECK (pricing_under_25_insurance >= 0),
  pricing_extra_driver numeric(10,2) CHECK (pricing_extra_driver >= 0),
  pricing_delivery numeric(10,2) CHECK (pricing_delivery >= 0),
  pricing_option_1 numeric(10,2) CHECK (pricing_option_1 >= 0),
  pricing_option_2 numeric(10,2) CHECK (pricing_option_2 >= 0),
  pricing_option_3 numeric(10,2) CHECK (pricing_option_3 >= 0),
  pricing_fuel numeric(10,2) CHECK (pricing_fuel >= 0),
  pricing_misc numeric(10,2) CHECK (pricing_misc >= 0),
  pricing_damage numeric(10,2) CHECK (pricing_damage >= 0),
  pricing_total_ht numeric(10,2) CHECK (pricing_total_ht >= 0),
  pricing_vat_20 numeric(10,2) CHECK (pricing_vat_20 >= 0),
  pricing_total_ttc numeric(10,2) CHECK (pricing_total_ttc >= 0),
  pricing_total_prepaid numeric(10,2) CHECK (pricing_total_prepaid >= 0),
  pricing_balance numeric(10,2),
  UNIQUE (contract_id, revision_no), CHECK ((kind = 'departure' AND revision_no = 1) OR (kind = 'amendment' AND revision_no > 1 AND reason IS NOT NULL))
);

CREATE TABLE contract_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  contract_id uuid NOT NULL REFERENCES contracts(id),
  client_id uuid NOT NULL REFERENCES clients(id),
  role varchar(32) NOT NULL CHECK (role IN ('renter', 'additional')),
  UNIQUE (contract_id, role), UNIQUE (contract_id, client_id)
);

CREATE TABLE inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  contract_id uuid NOT NULL REFERENCES contracts(id),
  stage varchar(32) NOT NULL CHECK (stage IN ('departure', 'return')),
  status varchar(32) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  at timestamptz NOT NULL,
  km integer CHECK (km >= 0) NOT NULL,
  fuel integer CHECK (fuel BETWEEN 0 AND 8) NOT NULL,
  car_papers boolean,
  clean_inside boolean,
  clean_outside boolean,
  gps boolean,
  agent_name varchar(80) NOT NULL,
  baseline_id uuid REFERENCES condition_baselines(id),
  open_damage_ids uuid[] NOT NULL DEFAULT '{}',
  ras boolean NOT NULL DEFAULT false,
  comment varchar(500),
  final_pricing_rental numeric(10,2) CHECK (final_pricing_rental >= 0),
  final_pricing_extra_days numeric(10,2) CHECK (final_pricing_extra_days >= 0),
  final_pricing_extra_km numeric(10,2) CHECK (final_pricing_extra_km >= 0),
  final_pricing_rental_total_ht numeric(10,2) CHECK (final_pricing_rental_total_ht >= 0),
  final_pricing_under_25_insurance numeric(10,2) CHECK (final_pricing_under_25_insurance >= 0),
  final_pricing_extra_driver numeric(10,2) CHECK (final_pricing_extra_driver >= 0),
  final_pricing_delivery numeric(10,2) CHECK (final_pricing_delivery >= 0),
  final_pricing_option_1 numeric(10,2) CHECK (final_pricing_option_1 >= 0),
  final_pricing_option_2 numeric(10,2) CHECK (final_pricing_option_2 >= 0),
  final_pricing_option_3 numeric(10,2) CHECK (final_pricing_option_3 >= 0),
  final_pricing_fuel numeric(10,2) CHECK (final_pricing_fuel >= 0),
  final_pricing_misc numeric(10,2) CHECK (final_pricing_misc >= 0),
  final_pricing_damage numeric(10,2) CHECK (final_pricing_damage >= 0),
  final_pricing_total_ht numeric(10,2) CHECK (final_pricing_total_ht >= 0),
  final_pricing_vat_20 numeric(10,2) CHECK (final_pricing_vat_20 >= 0),
  final_pricing_total_ttc numeric(10,2) CHECK (final_pricing_total_ttc >= 0),
  final_pricing_total_prepaid numeric(10,2) CHECK (final_pricing_total_prepaid >= 0),
  final_pricing_balance numeric(10,2),
  UNIQUE (contract_id, stage), UNIQUE (id, contract_id, stage), CHECK (baseline_id IS NULL OR stage = 'departure')
);

CREATE TABLE damages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  comment varchar(500) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'repaired')),
  found_stage varchar(32) NOT NULL CHECK (found_stage IN ('departure', 'return', 'vehicle_file')),
  found_contract_id uuid,
  found_in_inspection_id uuid,
  estimate_amount numeric(10,2) CHECK (estimate_amount >= 0),
  estimate_mode varchar(32) CHECK (estimate_mode IN ('indicative', 'billed')),
  repaired_in_maintenance_id uuid,
  repaired_on date,
  FOREIGN KEY (found_contract_id, vehicle_id) REFERENCES contracts(id, vehicle_id),
  FOREIGN KEY (found_in_inspection_id, found_contract_id, found_stage) REFERENCES inspections(id, contract_id, stage),
  FOREIGN KEY (repaired_in_maintenance_id, vehicle_id) REFERENCES maintenance_records(id, vehicle_id),
  CHECK ((found_stage = 'vehicle_file' AND found_contract_id IS NULL AND found_in_inspection_id IS NULL) OR (found_stage IN ('departure', 'return') AND found_contract_id IS NOT NULL AND found_in_inspection_id IS NOT NULL)),
  CHECK ((estimate_amount IS NULL) = (estimate_mode IS NULL)),
  CHECK (estimate_amount IS NULL OR found_stage = 'return')
);

CREATE TABLE photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  baseline_id uuid REFERENCES condition_baselines(id),
  damage_id uuid REFERENCES damages(id),
  inspection_id uuid REFERENCES inspections(id),
  kind varchar(32) NOT NULL CHECK (kind IN ('reference', 'damage', 'dashboard')),
  angle varchar(32) CHECK (angle IN ('front', 'rear', 'left', 'right', 'front_left', 'rear_left', 'rear_right', 'front_right', 'interior')),
  storage_path varchar(1024) NOT NULL,
  sha256 varchar(64) CHECK (sha256 ~ '^[0-9a-f]{64}$') NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  imported boolean NOT NULL DEFAULT false,
  taken_at timestamptz NOT NULL,
  taken_by uuid NOT NULL REFERENCES staff_profiles(id),
  CHECK (num_nonnulls(baseline_id, damage_id, inspection_id) = 1),
  CHECK ((kind = 'reference' AND baseline_id IS NOT NULL AND angle IS NOT NULL) OR (kind = 'damage' AND damage_id IS NOT NULL AND angle IS NULL) OR (kind = 'dashboard' AND inspection_id IS NOT NULL AND angle IS NULL)),
  UNIQUE (baseline_id, angle), UNIQUE (inspection_id)
);

CREATE TABLE client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  client_id uuid NOT NULL REFERENCES clients(id),
  type varchar(32) NOT NULL CHECK (type IN ('licence', 'id_card', 'passport', 'other')),
  label varchar(80),
  storage_path varchar(1024) NOT NULL,
  sha256 varchar(64) CHECK (sha256 ~ '^[0-9a-f]{64}$') NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760)
  
);

CREATE TABLE contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  contract_id uuid NOT NULL REFERENCES contracts(id),
  revision_no integer NOT NULL,
  stage varchar(32) NOT NULL CHECK (stage IN ('preview', 'departure', 'final', 'authorisation')),
  language varchar(32) NOT NULL CHECK (language IN ('fr', 'en')),
  template_version varchar(80) NOT NULL,
  terms_version_id uuid NOT NULL REFERENCES terms_versions(id),
  storage_path varchar(1024) NOT NULL,
  sha256 varchar(64) CHECK (sha256 ~ '^[0-9a-f]{64}$') NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  copy_of_id uuid REFERENCES contract_documents(id),
  FOREIGN KEY (contract_id, revision_no) REFERENCES contract_revisions(contract_id, revision_no), UNIQUE (id, contract_id)
);

CREATE TABLE stored_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  contract_id uuid NOT NULL UNIQUE REFERENCES contracts(id),
  image_path varchar(1024) NOT NULL,
  image_sha256 varchar(64) CHECK (image_sha256 ~ '^[0-9a-f]{64}$') NOT NULL,
  strokes_path varchar(1024) NOT NULL,
  strokes_sha256 varchar(64) NOT NULL CHECK (strokes_sha256 ~ '^[0-9a-f]{64}$'),
  image_size_bytes integer NOT NULL CHECK (image_size_bytes > 0),
  strokes_size_bytes integer NOT NULL CHECK (strokes_size_bytes > 0),
  authorisation_version_id uuid NOT NULL REFERENCES terms_versions(id),
  authorisation_pdf_id uuid NOT NULL,
  captured_at timestamptz NOT NULL,
  captured_by uuid NOT NULL REFERENCES staff_profiles(id),
  capture_place varchar(80),
  capture_agent_name varchar(80) NOT NULL,
  km_at_capture integer CHECK (km_at_capture >= 0),
  fuel_at_capture integer CHECK (fuel_at_capture BETWEEN 0 AND 8),
  status varchar(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'cancelled')),
  applied_at timestamptz,
  applied_by uuid REFERENCES staff_profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES staff_profiles(id),
  cancel_reason varchar(500),
  FOREIGN KEY (authorisation_pdf_id, contract_id) REFERENCES contract_documents(id, contract_id), UNIQUE (id, contract_id),
  CHECK ((status = 'pending' AND applied_at IS NULL AND applied_by IS NULL AND cancelled_at IS NULL AND cancelled_by IS NULL AND cancel_reason IS NULL) OR (status = 'applied' AND applied_at IS NOT NULL AND applied_by IS NOT NULL AND cancelled_at IS NULL AND cancelled_by IS NULL AND cancel_reason IS NULL) OR (status = 'cancelled' AND applied_at IS NULL AND applied_by IS NULL AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND cancel_reason IS NOT NULL))
);

CREATE TABLE signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  contract_id uuid NOT NULL REFERENCES contracts(id),
  revision_no integer NOT NULL,
  stage varchar(32) NOT NULL CHECK (stage IN ('departure', 'return')),
  mode varchar(32) NOT NULL CHECK (mode IN ('in_person', 'stored')),
  stored_signature_id uuid,
  image_path varchar(1024) NOT NULL,
  image_sha256 varchar(64) CHECK (image_sha256 ~ '^[0-9a-f]{64}$') NOT NULL,
  strokes_path varchar(1024) NOT NULL,
  strokes_sha256 varchar(64) NOT NULL CHECK (strokes_sha256 ~ '^[0-9a-f]{64}$'),
  image_size_bytes integer NOT NULL CHECK (image_size_bytes > 0),
  strokes_size_bytes integer NOT NULL CHECK (strokes_size_bytes > 0),
  preview_id uuid NOT NULL,
  preview_sha256 varchar(64) CHECK (preview_sha256 ~ '^[0-9a-f]{64}$') NOT NULL,
  sealed_pdf_sha256 varchar(64) CHECK (sealed_pdf_sha256 ~ '^[0-9a-f]{64}$') NOT NULL,
  sealed_pdf_id uuid NOT NULL,
  signed_at timestamptz NOT NULL,
  staff_id uuid NOT NULL REFERENCES staff_profiles(id),
  device_model varchar(80) NOT NULL,
  os_version varchar(80) NOT NULL,
  app_version varchar(80) NOT NULL,
  ip_address inet NOT NULL,
  snapshot_sha256 varchar(64) CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$') NOT NULL,
  terms_version_ids uuid[] NOT NULL CHECK (cardinality(terms_version_ids) BETWEEN 1 AND 2 AND array_position(terms_version_ids, NULL) IS NULL),
  FOREIGN KEY (contract_id, revision_no) REFERENCES contract_revisions(contract_id, revision_no),
  FOREIGN KEY (preview_id, contract_id) REFERENCES contract_documents(id, contract_id),
  FOREIGN KEY (sealed_pdf_id, contract_id) REFERENCES contract_documents(id, contract_id),
  FOREIGN KEY (stored_signature_id, contract_id) REFERENCES stored_signatures(id, contract_id),
  CHECK ((mode = 'stored' AND stage = 'return' AND stored_signature_id IS NOT NULL) OR (mode = 'in_person' AND stored_signature_id IS NULL)), UNIQUE (contract_id, stage), UNIQUE (stored_signature_id)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  actor_id uuid REFERENCES staff_profiles(id),
  action varchar(80) NOT NULL,
  table_name varchar(80) NOT NULL,
  row_id uuid NOT NULL,
  before_values jsonb,
  after_values jsonb
  
);

CREATE TABLE contract_number_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES staff_profiles(id),
  year integer NOT NULL UNIQUE CHECK (year BETWEEN 2000 AND 9999),
  last_value integer NOT NULL CHECK (last_value BETWEEN 1 AND 9999)
  
);

-- Evidence guards also protect against accidental writes by maintenance scripts.
CREATE FUNCTION reject_evidence_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'evidence is insert-only: %', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;
CREATE FUNCTION freeze_completed_row() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF (TG_TABLE_NAME = 'contract_revisions' AND (to_jsonb(OLD)->>'signed_at' IS NOT NULL OR to_jsonb(OLD)->>'kind' = 'amendment'))
     OR (TG_TABLE_NAME = 'inspections' AND to_jsonb(OLD)->>'status' = 'completed') THEN
    RAISE EXCEPTION 'completed evidence is immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER condition_baselines_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON condition_baselines FOR EACH STATEMENT EXECUTE FUNCTION reject_evidence_mutation();

CREATE TRIGGER photos_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON photos FOR EACH STATEMENT EXECUTE FUNCTION reject_evidence_mutation();

CREATE TRIGGER signatures_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON signatures FOR EACH STATEMENT EXECUTE FUNCTION reject_evidence_mutation();

CREATE TRIGGER contract_documents_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON contract_documents FOR EACH STATEMENT EXECUTE FUNCTION reject_evidence_mutation();

CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_events FOR EACH STATEMENT EXECUTE FUNCTION reject_evidence_mutation();

CREATE TRIGGER terms_versions_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON terms_versions FOR EACH STATEMENT EXECUTE FUNCTION reject_evidence_mutation();

CREATE TRIGGER contract_revisions_freeze BEFORE UPDATE OR DELETE ON contract_revisions FOR EACH ROW EXECUTE FUNCTION freeze_completed_row();
CREATE TRIGGER contract_revisions_no_truncate BEFORE TRUNCATE ON contract_revisions FOR EACH STATEMENT EXECUTE FUNCTION reject_evidence_mutation();

CREATE TRIGGER inspections_freeze BEFORE UPDATE OR DELETE ON inspections FOR EACH ROW EXECUTE FUNCTION freeze_completed_row();
CREATE TRIGGER inspections_no_truncate BEFORE TRUNCATE ON inspections FOR EACH STATEMENT EXECUTE FUNCTION reject_evidence_mutation();

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcr_api;
REVOKE ALL ON schema_migrations FROM mcr_api;

GRANT INSERT (id, created_at, created_by, plate, make_model, colour, fuel_type, current_km, current_fuel, current_baseline_id, notes) ON vehicles TO mcr_api;

GRANT UPDATE (plate, make_model, colour, fuel_type, current_km, current_fuel, current_baseline_id, notes) ON vehicles TO mcr_api;

GRANT INSERT (id, created_at, created_by, title, first_name, last_name, email, phone, street, line2, postcode, city, state_region, country, local_address, local_phone, birth_date, birth_place_or_country, id_doc_type, id_doc_number, id_doc_country, id_doc_issued_on, id_doc_expires_on, licence_number, licence_issued_on, licence_expires_on) ON clients TO mcr_api;

GRANT UPDATE (title, first_name, last_name, email, phone, street, line2, postcode, city, state_region, country, local_address, local_phone, birth_date, birth_place_or_country, id_doc_type, id_doc_number, id_doc_country, id_doc_issued_on, id_doc_expires_on, licence_number, licence_issued_on, licence_expires_on) ON clients TO mcr_api;

GRANT INSERT (id, created_at, created_by, vehicle_id, reason, taken_at, taken_by) ON condition_baselines TO mcr_api;

GRANT INSERT (id, created_at, created_by, vehicle_id, kind, description, started_on, finished_on, odometer_km) ON maintenance_records TO mcr_api;

GRANT UPDATE (description, started_on, finished_on, odometer_km) ON maintenance_records TO mcr_api;

GRANT INSERT (id, created_at, created_by, vehicle_id, current_revision_no, void_reason) ON contracts TO mcr_api;

GRANT UPDATE (void_reason) ON contracts TO mcr_api;

GRANT INSERT (id, created_at, created_by, contract_id, revision_no, kind, terms_version_fr_id, terms_version_en_id, snapshot_sha256, reason, renter_title, renter_first_name, renter_last_name, renter_email, renter_phone, renter_street, renter_line2, renter_postcode, renter_city, renter_state_region, renter_country, renter_local_address, renter_local_phone, renter_birth_date, renter_birth_place_or_country, renter_id_doc_type, renter_id_doc_number, renter_id_doc_country, renter_id_doc_issued_on, renter_id_doc_expires_on, renter_licence_number, renter_licence_issued_on, renter_licence_expires_on, additional_title, additional_first_name, additional_last_name, additional_email, additional_phone, additional_street, additional_line2, additional_postcode, additional_city, additional_state_region, additional_country, additional_local_address, additional_local_phone, additional_birth_date, additional_birth_place_or_country, additional_id_doc_type, additional_id_doc_number, additional_id_doc_country, additional_id_doc_issued_on, additional_id_doc_expires_on, additional_licence_number, additional_licence_issued_on, additional_licence_expires_on, vehicle_plate, vehicle_make_model, vehicle_colour, vehicle_fuel_type, pickup_place, return_place, departure_at, planned_return, rental_days, flight_train, additional_info, intermediary, intermediary_phone, departure_agent, rate_1_3, rate_4_7, rate_extra_day_1, rate_extra_day_2, rate_package_price, rate_extra_km, rate_package_days, rate_km_included, deductible_theft, deductible_accident, deposit, card_brand, payment_method, card_last4, card_expiry, pricing_rental, pricing_extra_days, pricing_extra_km, pricing_rental_total_ht, pricing_under_25_insurance, pricing_extra_driver, pricing_delivery, pricing_option_1, pricing_option_2, pricing_option_3, pricing_fuel, pricing_misc, pricing_damage, pricing_total_ht, pricing_vat_20, pricing_total_ttc, pricing_total_prepaid, pricing_balance) ON contract_revisions TO mcr_api;

GRANT UPDATE (terms_version_fr_id, terms_version_en_id, snapshot_sha256, reason, renter_title, renter_first_name, renter_last_name, renter_email, renter_phone, renter_street, renter_line2, renter_postcode, renter_city, renter_state_region, renter_country, renter_local_address, renter_local_phone, renter_birth_date, renter_birth_place_or_country, renter_id_doc_type, renter_id_doc_number, renter_id_doc_country, renter_id_doc_issued_on, renter_id_doc_expires_on, renter_licence_number, renter_licence_issued_on, renter_licence_expires_on, additional_title, additional_first_name, additional_last_name, additional_email, additional_phone, additional_street, additional_line2, additional_postcode, additional_city, additional_state_region, additional_country, additional_local_address, additional_local_phone, additional_birth_date, additional_birth_place_or_country, additional_id_doc_type, additional_id_doc_number, additional_id_doc_country, additional_id_doc_issued_on, additional_id_doc_expires_on, additional_licence_number, additional_licence_issued_on, additional_licence_expires_on, vehicle_plate, vehicle_make_model, vehicle_colour, vehicle_fuel_type, pickup_place, return_place, departure_at, planned_return, rental_days, flight_train, additional_info, intermediary, intermediary_phone, departure_agent, rate_1_3, rate_4_7, rate_extra_day_1, rate_extra_day_2, rate_package_price, rate_extra_km, rate_package_days, rate_km_included, deductible_theft, deductible_accident, deposit, card_brand, payment_method, card_last4, card_expiry, pricing_rental, pricing_extra_days, pricing_extra_km, pricing_rental_total_ht, pricing_under_25_insurance, pricing_extra_driver, pricing_delivery, pricing_option_1, pricing_option_2, pricing_option_3, pricing_fuel, pricing_misc, pricing_damage, pricing_total_ht, pricing_vat_20, pricing_total_ttc, pricing_total_prepaid, pricing_balance) ON contract_revisions TO mcr_api;

GRANT INSERT (id, created_at, created_by, contract_id, client_id, role) ON contract_drivers TO mcr_api;

GRANT UPDATE (client_id, role) ON contract_drivers TO mcr_api;

GRANT INSERT (id, created_at, created_by, contract_id, stage, at, km, fuel, car_papers, clean_inside, clean_outside, gps, agent_name, baseline_id, open_damage_ids, ras, comment, final_pricing_rental, final_pricing_extra_days, final_pricing_extra_km, final_pricing_rental_total_ht, final_pricing_under_25_insurance, final_pricing_extra_driver, final_pricing_delivery, final_pricing_option_1, final_pricing_option_2, final_pricing_option_3, final_pricing_fuel, final_pricing_misc, final_pricing_damage, final_pricing_total_ht, final_pricing_vat_20, final_pricing_total_ttc, final_pricing_total_prepaid, final_pricing_balance) ON inspections TO mcr_api;

GRANT UPDATE (at, km, fuel, car_papers, clean_inside, clean_outside, gps, agent_name, baseline_id, open_damage_ids, ras, comment, final_pricing_rental, final_pricing_extra_days, final_pricing_extra_km, final_pricing_rental_total_ht, final_pricing_under_25_insurance, final_pricing_extra_driver, final_pricing_delivery, final_pricing_option_1, final_pricing_option_2, final_pricing_option_3, final_pricing_fuel, final_pricing_misc, final_pricing_damage, final_pricing_total_ht, final_pricing_vat_20, final_pricing_total_ttc, final_pricing_total_prepaid, final_pricing_balance) ON inspections TO mcr_api;

GRANT INSERT (id, created_at, created_by, vehicle_id, comment, found_stage, found_contract_id, found_in_inspection_id, estimate_amount, estimate_mode) ON damages TO mcr_api;

GRANT INSERT (id, created_at, created_by, baseline_id, damage_id, inspection_id, kind, angle, storage_path, sha256, size_bytes, imported, taken_at, taken_by) ON photos TO mcr_api;

GRANT INSERT (id, created_at, created_by, client_id, type, label, storage_path, sha256, size_bytes) ON client_documents TO mcr_api;

GRANT UPDATE (client_id, type, label, storage_path, sha256, size_bytes) ON client_documents TO mcr_api;

GRANT INSERT (id, created_at, created_by, contract_id, revision_no, stage, language, template_version, terms_version_id, storage_path, sha256, size_bytes, copy_of_id) ON contract_documents TO mcr_api;

GRANT INSERT (id, created_at, created_by, contract_id, image_path, image_sha256, strokes_path, strokes_sha256, image_size_bytes, strokes_size_bytes, authorisation_version_id, authorisation_pdf_id, captured_at, captured_by, capture_place, capture_agent_name, km_at_capture, fuel_at_capture) ON stored_signatures TO mcr_api;

GRANT INSERT (id, created_at, created_by, contract_id, revision_no, stage, mode, stored_signature_id, image_path, image_sha256, strokes_path, strokes_sha256, image_size_bytes, strokes_size_bytes, preview_id, preview_sha256, sealed_pdf_sha256, sealed_pdf_id, staff_id, device_model, os_version, app_version, ip_address, snapshot_sha256, terms_version_ids, signed_at) ON signatures TO mcr_api;

GRANT INSERT (id, created_at, created_by, actor_id, action, table_name, row_id, before_values, after_values) ON audit_events TO mcr_api;


-- migrate:down

DROP TABLE contract_number_counters CASCADE;

DROP TABLE audit_events CASCADE;

DROP TABLE signatures CASCADE;

DROP TABLE stored_signatures CASCADE;

DROP TABLE contract_documents CASCADE;

DROP TABLE client_documents CASCADE;

DROP TABLE photos CASCADE;

DROP TABLE damages CASCADE;

DROP TABLE inspections CASCADE;

DROP TABLE contract_drivers CASCADE;

DROP TABLE contract_revisions CASCADE;

DROP TABLE terms_versions CASCADE;

DROP TABLE contracts CASCADE;

DROP TABLE maintenance_records CASCADE;

DROP TABLE condition_baselines CASCADE;

DROP TABLE clients CASCADE;

DROP TABLE vehicles CASCADE;

DROP TABLE staff_profiles CASCADE;

DROP FUNCTION freeze_completed_row();
DROP FUNCTION reject_evidence_mutation();

