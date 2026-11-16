BEGIN;

CREATE OR REPLACE FUNCTION public.recalculate_rab_project(
  p_rab_id text,
  p_profit_type text DEFAULT NULL,
  p_profit_percentage numeric DEFAULT NULL,
  p_overhead_percentage numeric DEFAULT NULL,
  p_contingency_percentage numeric DEFAULT NULL,
  p_tax_percentage numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_org_id text;
  v_rab public.rab_projects%ROWTYPE;
  v_updated public.rab_projects%ROWTYPE;
  v_item public.rab_items%ROWTYPE;
  v_profit_type text;
  v_profit_percentage numeric;
  v_overhead_percentage numeric;
  v_contingency_percentage numeric;
  v_tax_percentage numeric;
  v_total_material_hpp numeric(15, 2) := 0;
  v_total_labor_hpp numeric(15, 2) := 0;
  v_total_equipment_hpp numeric(15, 2) := 0;
  v_total_hpp numeric(15, 2) := 0;
  v_overhead_amount numeric(15, 2) := 0;
  v_contingency_amount numeric(15, 2) := 0;
  v_profit_amount numeric(15, 2) := 0;
  v_subtotal_before_tax numeric(15, 2) := 0;
  v_tax_amount numeric(15, 2) := 0;
  v_grand_total numeric(15, 2) := 0;
  v_cost_before_profit numeric(15, 2) := 0;
  v_item_count integer := 0;
  v_item_index integer := 0;
  v_item_material numeric(15, 2);
  v_item_labor numeric(15, 2);
  v_item_equipment numeric(15, 2);
  v_item_hpp numeric(15, 2);
  v_item_total_price numeric(15, 2);
  v_allocated_total numeric(15, 2) := 0;
  v_last_item_id text;
BEGIN
  v_org_id := get_user_organization_id();
  IF v_org_id IS NULL OR get_user_role() NOT IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER') THEN
    RAISE EXCEPTION 'Role tidak memiliki izin untuk menghitung ulang RAB';
  END IF;

  SELECT * INTO v_rab
  FROM public.rab_projects
  WHERE id = p_rab_id AND organization_id = v_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RAB tidak ditemukan di organisasi ini';
  END IF;
  IF v_rab.status = 'APPROVED' OR v_rab.is_locked THEN
    RAISE EXCEPTION 'RAB yang disetujui dan dikunci tidak dapat dihitung ulang';
  END IF;

  v_profit_type := COALESCE(p_profit_type, v_rab.profit_type);
  v_profit_percentage := COALESCE(p_profit_percentage, v_rab.profit_percentage);
  v_overhead_percentage := COALESCE(p_overhead_percentage, v_rab.overhead_percentage);
  v_contingency_percentage := COALESCE(p_contingency_percentage, v_rab.contingency_percentage);
  v_tax_percentage := COALESCE(p_tax_percentage, v_rab.tax_percentage);

  IF v_profit_type NOT IN ('MARKUP', 'GROSS_MARGIN')
    OR v_profit_percentage < 0
    OR (v_profit_type = 'GROSS_MARGIN' AND v_profit_percentage >= 100)
    OR v_overhead_percentage < 0 OR v_overhead_percentage > 100
    OR v_contingency_percentage < 0 OR v_contingency_percentage > 100
    OR v_tax_percentage < 0 OR v_tax_percentage > 100 THEN
    RAISE EXCEPTION 'Parameter profit, overhead, contingency, atau pajak tidak valid';
  END IF;

  FOR v_item IN
    SELECT * FROM public.rab_items
    WHERE rab_id = p_rab_id AND organization_id = v_org_id
    ORDER BY sort_order, id
    FOR UPDATE
  LOOP
    v_item_count := v_item_count + 1;
    v_item_material := round(v_item.material_unit_cost * v_item.volume, 2);
    v_item_labor := round(v_item.labor_unit_cost * v_item.volume, 2);
    v_item_equipment := round(v_item.equipment_unit_cost * v_item.volume, 2);
    v_item_hpp := v_item_material + v_item_labor + v_item_equipment;
    v_total_material_hpp := v_total_material_hpp + v_item_material;
    v_total_labor_hpp := v_total_labor_hpp + v_item_labor;
    v_total_equipment_hpp := v_total_equipment_hpp + v_item_equipment;
    v_total_hpp := v_total_hpp + v_item_hpp;
    IF v_item_hpp > 0 THEN
      v_last_item_id := v_item.id;
    END IF;
  END LOOP;

  v_overhead_amount := round(v_total_hpp * v_overhead_percentage / 100, 2);
  v_contingency_amount := round(v_total_hpp * v_contingency_percentage / 100, 2);
  v_cost_before_profit := v_total_hpp + v_overhead_amount + v_contingency_amount;
  IF v_profit_type = 'MARKUP' THEN
    v_profit_amount := round(v_cost_before_profit * v_profit_percentage / 100, 2);
  ELSE
    v_profit_amount := round(v_cost_before_profit * v_profit_percentage / (100 - v_profit_percentage), 2);
  END IF;
  v_subtotal_before_tax := v_cost_before_profit + v_profit_amount;
  v_tax_amount := round(v_subtotal_before_tax * v_tax_percentage / 100, 2);
  v_grand_total := v_subtotal_before_tax + v_tax_amount;

  FOR v_item IN
    SELECT * FROM public.rab_items
    WHERE rab_id = p_rab_id AND organization_id = v_org_id
    ORDER BY sort_order, id
    FOR UPDATE
  LOOP
    v_item_material := round(v_item.material_unit_cost * v_item.volume, 2);
    v_item_labor := round(v_item.labor_unit_cost * v_item.volume, 2);
    v_item_equipment := round(v_item.equipment_unit_cost * v_item.volume, 2);
    v_item_hpp := v_item_material + v_item_labor + v_item_equipment;
    v_item_total_price := CASE
      WHEN v_item_hpp = 0 OR v_total_hpp = 0 THEN 0
      WHEN v_item.id = v_last_item_id THEN v_grand_total - v_allocated_total
      ELSE round(v_grand_total * v_item_hpp / v_total_hpp, 2)
    END;
    v_allocated_total := v_allocated_total + v_item_total_price;

    UPDATE public.rab_items
    SET unit_hpp = round(v_item.material_unit_cost + v_item.labor_unit_cost + v_item.equipment_unit_cost, 2),
        total_hpp = v_item_hpp,
        unit_price = CASE WHEN v_item.volume > 0 THEN round(v_item_total_price / v_item.volume, 2) ELSE 0 END,
        total_price = v_item_total_price
    WHERE id = v_item.id AND rab_id = p_rab_id AND organization_id = v_org_id;
  END LOOP;

  UPDATE public.rab_projects
  SET profit_type = v_profit_type,
      profit_percentage = v_profit_percentage,
      overhead_percentage = v_overhead_percentage,
      contingency_percentage = v_contingency_percentage,
      tax_percentage = v_tax_percentage,
      total_material_hpp = v_total_material_hpp,
      total_labor_hpp = v_total_labor_hpp,
      total_equipment_hpp = v_total_equipment_hpp,
      total_hpp = v_total_hpp,
      overhead_amount = v_overhead_amount,
      contingency_amount = v_contingency_amount,
      profit_amount = v_profit_amount,
      subtotal_before_tax = v_subtotal_before_tax,
      tax_amount = v_tax_amount,
      grand_total = v_grand_total,
      updated_at = now()
  WHERE id = p_rab_id AND organization_id = v_org_id
  RETURNING * INTO v_updated;

  RETURN to_jsonb(v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_rab_project(text, text, numeric, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_rab_project(text, text, numeric, numeric, numeric, numeric) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
