BEGIN;

CREATE OR REPLACE FUNCTION public.sync_material_average_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_organization_id text;
  v_material_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_organization_id := OLD.organization_id;
    v_material_id := OLD.material_id;
  ELSE
    v_organization_id := NEW.organization_id;
    v_material_id := NEW.material_id;
  END IF;

  UPDATE public.master_materials AS material
  SET standard_price = prices.average_price,
      min_price = prices.min_price,
      max_price = prices.max_price,
      updated_at = now()
  FROM (
    SELECT
      organization_id,
      material_id,
      round((min(unit_price) + max(unit_price)) / 2) AS average_price,
      min(unit_price) AS min_price,
      max(unit_price) AS max_price
    FROM public.material_price_history
    WHERE organization_id = v_organization_id
      AND material_id = v_material_id
    GROUP BY organization_id, material_id
  ) AS prices
  WHERE material.id = prices.material_id
    AND material.organization_id = prices.organization_id;

  UPDATE public.master_ahsp_components AS component
  SET unit_price = material.standard_price,
      subtotal = component.coefficient * material.standard_price
  FROM public.master_ahsp AS ahsp,
       public.master_materials AS material
  WHERE component.ahsp_id = ahsp.id
    AND component.material_id = material.id
    AND ahsp.organization_id = v_organization_id
    AND material.organization_id = v_organization_id
    AND material.id = v_material_id
    AND component.component_type = 'MATERIAL';

  IF NOT EXISTS (
    SELECT 1
    FROM public.material_price_history
    WHERE organization_id = v_organization_id
      AND material_id = v_material_id
  ) THEN
    UPDATE public.master_materials
    SET standard_price = 0,
        min_price = 0,
        max_price = 0,
        updated_at = now()
    WHERE id = v_material_id
      AND organization_id = v_organization_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_material_average_price() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS material_price_history_sync_average ON public.material_price_history;
CREATE CONSTRAINT TRIGGER material_price_history_sync_average
  AFTER INSERT OR DELETE ON public.material_price_history
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_material_average_price();

WITH price_summary AS (
  SELECT
    organization_id,
    material_id,
    round((min(unit_price) + max(unit_price)) / 2) AS average_price,
    min(unit_price) AS min_price,
    max(unit_price) AS max_price
  FROM public.material_price_history
  GROUP BY organization_id, material_id
)
UPDATE public.master_materials AS material
SET standard_price = prices.average_price,
    min_price = prices.min_price,
    max_price = prices.max_price,
    updated_at = now()
FROM price_summary AS prices
WHERE material.id = prices.material_id
  AND material.organization_id = prices.organization_id;

UPDATE public.master_ahsp_components AS component
SET unit_price = material.standard_price,
    subtotal = component.coefficient * material.standard_price
FROM public.master_ahsp AS ahsp,
     public.master_materials AS material
WHERE component.ahsp_id = ahsp.id
  AND component.material_id = material.id
  AND ahsp.organization_id = material.organization_id
  AND component.component_type = 'MATERIAL';

COMMIT;

NOTIFY pgrst, 'reload schema';
