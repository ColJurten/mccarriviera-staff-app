-- migrate:up
-- Numbering helpers only: preview/signing transitions compose these in their transaction.
CREATE FUNCTION reserve_contract_number(p_contract_id uuid, p_year integer, p_actor_id uuid)
RETURNS varchar
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  existing_number varchar;
  next_value integer;
BEGIN
  IF p_year IS NULL OR p_year NOT BETWEEN 2000 AND 9999 THEN
    RAISE EXCEPTION 'invalid numbering year' USING ERRCODE = '22023';
  END IF;
  SELECT number INTO existing_number FROM public.contracts WHERE id = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract not found' USING ERRCODE = '22023'; END IF;
  IF existing_number IS NOT NULL THEN RETURN existing_number; END IF;
  IF NOT EXISTS (SELECT FROM public.staff_profiles WHERE id = p_actor_id) THEN
    RAISE EXCEPTION 'staff actor required' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.contract_number_counters(year, last_value, created_by)
    VALUES (p_year, 1, p_actor_id)
    ON CONFLICT (year) DO UPDATE SET last_value = public.contract_number_counters.last_value + 1
    RETURNING last_value INTO next_value;
  existing_number := 'MCR-' || p_year::text || '-' || lpad(next_value::text, 4, '0');
  UPDATE public.contracts SET number = existing_number, number_reserved_at = clock_timestamp()
    WHERE id = p_contract_id;
  RETURN existing_number;
END;
$$;

CREATE FUNCTION confirm_contract_number(p_contract_id uuid, p_number varchar)
RETURNS varchar
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE existing_number varchar;
BEGIN
  SELECT number INTO existing_number FROM public.contracts WHERE id = p_contract_id FOR UPDATE;
  IF NOT FOUND OR existing_number IS NULL OR p_number IS DISTINCT FROM existing_number THEN
    RAISE EXCEPTION 'reservation missing or mismatched' USING ERRCODE = '22023';
  END IF;
  UPDATE public.contracts SET number_confirmed_at = COALESCE(number_confirmed_at, clock_timestamp())
    WHERE id = p_contract_id;
  RETURN existing_number;
END;
$$;
REVOKE ALL ON FUNCTION reserve_contract_number(uuid, integer, uuid), confirm_contract_number(uuid, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reserve_contract_number(uuid, integer, uuid), confirm_contract_number(uuid, varchar) TO mcr_api;

-- migrate:down
DROP FUNCTION confirm_contract_number(uuid, varchar);
DROP FUNCTION reserve_contract_number(uuid, integer, uuid);
