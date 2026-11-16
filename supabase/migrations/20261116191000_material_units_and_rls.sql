BEGIN;

DROP POLICY IF EXISTS "Org members view master_materials" ON public.master_materials;
DROP POLICY IF EXISTS "Org staff manage master_materials" ON public.master_materials;
DROP POLICY IF EXISTS "Authorized members create master_materials" ON public.master_materials;
DROP POLICY IF EXISTS "Authorized members update master_materials" ON public.master_materials;
DROP POLICY IF EXISTS "Owners delete master_materials" ON public.master_materials;
DROP POLICY IF EXISTS "Org members view material_price_history" ON public.material_price_history;
DROP POLICY IF EXISTS "Org staff manage material_price_history" ON public.material_price_history;
DROP POLICY IF EXISTS "Authorized members create material_price_history" ON public.material_price_history;
DROP POLICY IF EXISTS "Owners delete material_price_history" ON public.material_price_history;
DROP POLICY IF EXISTS "Org members view project_materials" ON public.project_materials;
DROP POLICY IF EXISTS "Org staff manage project_materials" ON public.project_materials;
DROP POLICY IF EXISTS "Authorized members create project_materials" ON public.project_materials;
DROP POLICY IF EXISTS "Authorized members update project_materials" ON public.project_materials;
DROP POLICY IF EXISTS "Owners delete project_materials" ON public.project_materials;
DROP POLICY IF EXISTS "Org members view material_stock_movements" ON public.material_stock_movements;
DROP POLICY IF EXISTS "Org staff manage material_stock_movements" ON public.material_stock_movements;
DROP POLICY IF EXISTS "Authorized members create material_stock_movements" ON public.material_stock_movements;

CREATE POLICY "Org members view master_materials"
  ON public.master_materials FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Authorized members create master_materials"
  ON public.master_materials FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND conversion_factor > 0
    AND standard_price >= 0
  );

CREATE POLICY "Authorized members update master_materials"
  ON public.master_materials FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND conversion_factor > 0
    AND standard_price >= 0
  );

CREATE POLICY "Owners delete master_materials"
  ON public.master_materials FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'OWNER'
  );

CREATE POLICY "Org members view material_price_history"
  ON public.material_price_history FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.master_materials material
      WHERE material.id = material_price_history.material_id
        AND material.organization_id = get_user_organization_id()
    )
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.projects project
        WHERE project.id = material_price_history.project_id
          AND project.organization_id = get_user_organization_id()
      )
    )
    AND (
      vendor_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.vendors vendor
        WHERE vendor.id = material_price_history.vendor_id
          AND vendor.organization_id = get_user_organization_id()
      )
    )
  );

CREATE POLICY "Authorized members create material_price_history"
  ON public.material_price_history FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER', 'SITE_STAFF')
    AND EXISTS (
      SELECT 1 FROM public.master_materials material
      WHERE material.id = material_price_history.material_id
        AND material.organization_id = get_user_organization_id()
        AND lower(material.purchase_unit) = lower(material_price_history.unit)
    )
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.projects project
        WHERE project.id = material_price_history.project_id
          AND project.organization_id = get_user_organization_id()
      )
    )
    AND (
      vendor_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.vendors vendor
        WHERE vendor.id = material_price_history.vendor_id
          AND vendor.organization_id = get_user_organization_id()
      )
    )
    AND (
      expense_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.expenses expense
        WHERE expense.id = material_price_history.expense_id
          AND expense.organization_id = get_user_organization_id()
      )
    )
  );

CREATE POLICY "Owners delete material_price_history"
  ON public.material_price_history FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'OWNER'
  );

CREATE POLICY "Org members view project_materials"
  ON public.project_materials FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = project_materials.project_id
        AND project.organization_id = get_user_organization_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.master_materials material
      WHERE material.id = project_materials.material_id
        AND material.organization_id = get_user_organization_id()
    )
  );

CREATE POLICY "Authorized members create project_materials"
  ON public.project_materials FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = project_materials.project_id
        AND project.organization_id = get_user_organization_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.master_materials material
      WHERE material.id = project_materials.material_id
        AND material.organization_id = get_user_organization_id()
        AND lower(material.usage_unit) = lower(project_materials.unit)
    )
  );

CREATE POLICY "Authorized members update project_materials"
  ON public.project_materials FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = project_materials.project_id
        AND project.organization_id = get_user_organization_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.master_materials material
      WHERE material.id = project_materials.material_id
        AND material.organization_id = get_user_organization_id()
        AND lower(material.usage_unit) = lower(project_materials.unit)
    )
  );

CREATE POLICY "Owners delete project_materials"
  ON public.project_materials FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'OWNER'
  );

CREATE POLICY "Org members view material_stock_movements"
  ON public.material_stock_movements FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = material_stock_movements.project_id
        AND project.organization_id = get_user_organization_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.master_materials material
      WHERE material.id = material_stock_movements.material_id
        AND material.organization_id = get_user_organization_id()
    )
  );

CREATE POLICY "Authorized members create material_stock_movements"
  ON public.material_stock_movements FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER', 'SITE_STAFF')
    AND (
      movement_type <> 'USED'
      OR (
        get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
        AND verified_by = auth.uid()::text
      )
    )
    AND (movement_type = 'USED' OR verified_by IS NULL)
    AND EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = material_stock_movements.project_id
        AND project.organization_id = get_user_organization_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.master_materials material
      WHERE material.id = material_stock_movements.material_id
        AND material.organization_id = get_user_organization_id()
        AND lower(material.usage_unit) = lower(material_stock_movements.unit)
    )
    AND (
      target_project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.projects target_project
        WHERE target_project.id = material_stock_movements.target_project_id
          AND target_project.organization_id = get_user_organization_id()
      )
    )
    AND (
      vendor_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.vendors vendor
        WHERE vendor.id = material_stock_movements.vendor_id
          AND vendor.organization_id = get_user_organization_id()
      )
    )
    AND (
      expense_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.expenses expense
        WHERE expense.id = material_stock_movements.expense_id
          AND expense.organization_id = get_user_organization_id()
      )
    )
  );

DROP POLICY IF EXISTS "Org members view project_schedules" ON public.project_schedules;
DROP POLICY IF EXISTS "Org staff manage project_schedules" ON public.project_schedules;
DROP POLICY IF EXISTS "Authorized members create project_schedules" ON public.project_schedules;
DROP POLICY IF EXISTS "Authorized members update project_schedules" ON public.project_schedules;
DROP POLICY IF EXISTS "Authorized members delete project_schedules" ON public.project_schedules;
CREATE POLICY "Org members view project_schedules"
  ON public.project_schedules FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = project_schedules.project_id
        AND project.organization_id = get_user_organization_id()
    )
  );
CREATE POLICY "Authorized members create project_schedules"
  ON public.project_schedules FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = project_schedules.project_id
        AND project.organization_id = get_user_organization_id()
    )
    AND (
      rap_item_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.rap_items item
        JOIN public.rap_projects rap ON rap.id = item.rap_id
        WHERE item.id = project_schedules.rap_item_id
          AND rap.project_id = project_schedules.project_id
          AND rap.organization_id = get_user_organization_id()
      )
    )
  );
CREATE POLICY "Authorized members update project_schedules"
  ON public.project_schedules FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = project_schedules.project_id
        AND project.organization_id = get_user_organization_id()
    )
  );
CREATE POLICY "Authorized members delete project_schedules"
  ON public.project_schedules FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'PROJECT_MANAGER')
  );

DROP POLICY IF EXISTS "Org members view project_progress_records" ON public.project_progress_records;
DROP POLICY IF EXISTS "Org staff manage project_progress_records" ON public.project_progress_records;
DROP POLICY IF EXISTS "Authorized members create verified project_progress_records" ON public.project_progress_records;
DROP POLICY IF EXISTS "Authorized members update verified project_progress_records" ON public.project_progress_records;
CREATE POLICY "Org members view project_progress_records"
  ON public.project_progress_records FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = project_progress_records.project_id
        AND project.organization_id = get_user_organization_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.project_schedules schedule
      WHERE schedule.id = project_progress_records.schedule_id
        AND schedule.project_id = project_progress_records.project_id
        AND schedule.organization_id = get_user_organization_id()
    )
  );
CREATE POLICY "Authorized members create verified project_progress_records"
  ON public.project_progress_records FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND verified_by = auth.uid()::text
    AND verified_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.project_schedules schedule
      WHERE schedule.id = project_progress_records.schedule_id
        AND schedule.project_id = project_progress_records.project_id
        AND schedule.organization_id = get_user_organization_id()
    )
  );
CREATE POLICY "Authorized members update verified project_progress_records"
  ON public.project_progress_records FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND verified_by = auth.uid()::text
    AND verified_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.project_schedules schedule
      WHERE schedule.id = project_progress_records.schedule_id
        AND schedule.project_id = project_progress_records.project_id
        AND schedule.organization_id = get_user_organization_id()
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_material_unit_change_with_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.purchase_unit IS DISTINCT FROM OLD.purchase_unit
    OR NEW.usage_unit IS DISTINCT FROM OLD.usage_unit
    OR NEW.conversion_factor IS DISTINCT FROM OLD.conversion_factor
  ) AND (
    EXISTS (
      SELECT 1 FROM public.material_price_history history
      WHERE history.organization_id = OLD.organization_id
        AND history.material_id = OLD.id
    )
    OR EXISTS (
      SELECT 1 FROM public.project_materials plan
      WHERE plan.organization_id = OLD.organization_id
        AND plan.material_id = OLD.id
    )
    OR EXISTS (
      SELECT 1 FROM public.material_stock_movements movement
      WHERE movement.organization_id = OLD.organization_id
        AND movement.material_id = OLD.id
    )
  ) THEN
    RAISE EXCEPTION 'Satuan atau faktor konversi tidak dapat diubah setelah material memiliki transaksi atau rencana';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_material_unit_change_with_history ON public.master_materials;
CREATE TRIGGER prevent_material_unit_change_with_history
  BEFORE UPDATE OF purchase_unit, usage_unit, conversion_factor
  ON public.master_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_material_unit_change_with_history();

CREATE OR REPLACE FUNCTION public.record_material_purchase(
  p_material_id text,
  p_vendor_id text,
  p_vendor_name text,
  p_project_id text,
  p_purchase_date timestamptz,
  p_document_number text,
  p_quantity numeric,
  p_unit text,
  p_unit_price numeric,
  p_tax_amount numeric,
  p_notes text,
  p_record_stock_movement boolean,
  p_create_expense boolean,
  p_cash_account_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_organization_id text;
  v_profile_id text;
  v_user_role text;
  v_expense_id text;
  v_purchase_date timestamptz;
  v_total_price numeric(15, 2);
  v_purchase_unit text;
  v_usage_unit text;
  v_conversion_factor numeric(15, 4);
  v_history public.material_price_history%ROWTYPE;
BEGIN
  v_organization_id := get_user_organization_id();
  v_profile_id := auth.uid()::text;
  v_user_role := get_user_role();

  IF v_organization_id IS NULL OR v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF v_user_role NOT IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER', 'SITE_STAFF') THEN
    RAISE EXCEPTION 'Role tidak memiliki izin untuk mencatat pembelian material';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_unit_price IS NULL OR p_unit_price < 0 THEN
    RAISE EXCEPTION 'Kuantitas harus lebih besar dari 0 dan harga satuan tidak boleh negatif';
  END IF;
  IF COALESCE(p_tax_amount, 0) < 0 THEN
    RAISE EXCEPTION 'Pajak tidak boleh negatif';
  END IF;
  IF NULLIF(trim(p_vendor_name), '') IS NULL OR NULLIF(trim(p_unit), '') IS NULL THEN
    RAISE EXCEPTION 'Nama vendor dan satuan wajib diisi';
  END IF;

  SELECT purchase_unit, usage_unit, conversion_factor
  INTO v_purchase_unit, v_usage_unit, v_conversion_factor
  FROM public.master_materials
  WHERE id = p_material_id
    AND organization_id = v_organization_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material tidak ditemukan di organisasi ini';
  END IF;
  IF lower(trim(p_unit)) <> lower(trim(v_purchase_unit)) THEN
    RAISE EXCEPTION 'Pembelian harus menggunakan satuan beli %', v_purchase_unit;
  END IF;
  IF v_conversion_factor IS NULL OR v_conversion_factor <= 0 THEN
    RAISE EXCEPTION 'Faktor konversi material tidak valid';
  END IF;
  IF p_project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND organization_id = v_organization_id
  ) THEN
    RAISE EXCEPTION 'Proyek tidak ditemukan di organisasi ini';
  END IF;
  IF p_vendor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vendors
    WHERE id = p_vendor_id AND organization_id = v_organization_id
  ) THEN
    RAISE EXCEPTION 'Vendor tidak ditemukan di organisasi ini';
  END IF;

  IF COALESCE(p_create_expense, false) THEN
    IF p_cash_account_id IS NULL THEN
      RAISE EXCEPTION 'Rekening kas/bank wajib dipilih untuk mencatat pengeluaran';
    END IF;
    IF v_user_role NOT IN ('OWNER', 'FINANCE') THEN
      RAISE EXCEPTION 'Hanya OWNER atau FINANCE yang dapat mencatat pengeluaran pembelian material';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.cash_accounts
      WHERE id = p_cash_account_id AND organization_id = v_organization_id
    ) THEN
      RAISE EXCEPTION 'Rekening kas/bank tidak ditemukan di organisasi ini';
    END IF;
  END IF;

  v_purchase_date := COALESCE(p_purchase_date, now());
  v_total_price := p_quantity * p_unit_price + COALESCE(p_tax_amount, 0);

  IF COALESCE(p_create_expense, false) THEN
    INSERT INTO public.expenses (
      organization_id, number, date, merchant, description, amount, tax_amount,
      total_amount, payment_method, cash_account_id, category, project_id, source,
      status, submitted_by, notes
    ) VALUES (
      v_organization_id,
      'EXP-MAT-' || to_char(v_purchase_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      v_purchase_date,
      trim(p_vendor_name),
      'Pembelian material (' || p_quantity || ' ' || trim(p_unit) || ' @ Rp' || p_unit_price || ')',
      v_total_price,
      COALESCE(p_tax_amount, 0),
      v_total_price,
      'TRANSFER',
      p_cash_account_id,
      'Bahan Bangunan',
      p_project_id,
      'MATERIAL_PURCHASE',
      'APPROVED',
      v_profile_id,
      p_notes
    )
    RETURNING id INTO v_expense_id;
  END IF;

  INSERT INTO public.material_price_history (
    organization_id, material_id, vendor_id, vendor_name, project_id, expense_id,
    purchase_date, document_number, quantity, unit, unit_price, tax_amount,
    total_price, notes, created_by
  ) VALUES (
    v_organization_id, p_material_id, p_vendor_id, trim(p_vendor_name), p_project_id,
    v_expense_id, v_purchase_date, NULLIF(trim(p_document_number), ''), p_quantity,
    trim(p_unit), p_unit_price, COALESCE(p_tax_amount, 0), v_total_price, p_notes,
    v_profile_id
  )
  RETURNING * INTO v_history;

  IF v_user_role IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER') THEN
    UPDATE public.master_materials
    SET standard_price = p_unit_price,
        min_price = CASE WHEN min_price = 0 OR p_unit_price < min_price THEN p_unit_price ELSE min_price END,
        max_price = CASE WHEN p_unit_price > max_price THEN p_unit_price ELSE max_price END,
        updated_at = now()
    WHERE id = p_material_id
      AND organization_id = v_organization_id;
  END IF;

  IF COALESCE(p_record_stock_movement, true) AND p_project_id IS NOT NULL THEN
    INSERT INTO public.material_stock_movements (
      organization_id, project_id, material_id, movement_type, date, quantity,
      unit, unit_price, total_cost, vendor_id, expense_id, reference_document,
      notes, created_by
    ) VALUES (
      v_organization_id,
      p_project_id,
      p_material_id,
      'RECEIPT',
      v_purchase_date,
      p_quantity * v_conversion_factor,
      v_usage_unit,
      p_unit_price / v_conversion_factor,
      v_total_price,
      p_vendor_id,
      v_expense_id,
      NULLIF(trim(p_document_number), ''),
      'Penerimaan pembelian dari ' || trim(p_vendor_name),
      v_profile_id
    );
  END IF;

  RETURN jsonb_build_object('history', to_jsonb(v_history), 'expense_id', v_expense_id);
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
