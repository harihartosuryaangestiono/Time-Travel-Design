BEGIN;

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
  v_expense_id text;
  v_purchase_date timestamptz;
  v_total_price numeric(15, 2);
  v_history public.material_price_history%ROWTYPE;
BEGIN
  v_organization_id := get_user_organization_id();
  v_profile_id := auth.uid()::text;

  IF v_organization_id IS NULL OR v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
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
  IF NOT EXISTS (
    SELECT 1
    FROM public.master_materials
    WHERE id = p_material_id AND organization_id = v_organization_id
  ) THEN
    RAISE EXCEPTION 'Material tidak ditemukan di organisasi ini';
  END IF;
  IF p_project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = p_project_id AND organization_id = v_organization_id
  ) THEN
    RAISE EXCEPTION 'Proyek tidak ditemukan di organisasi ini';
  END IF;
  IF p_vendor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.vendors
    WHERE id = p_vendor_id AND organization_id = v_organization_id
  ) THEN
    RAISE EXCEPTION 'Vendor tidak ditemukan di organisasi ini';
  END IF;
  IF COALESCE(p_create_expense, false) THEN
    IF p_cash_account_id IS NULL THEN
      RAISE EXCEPTION 'Rekening kas/bank wajib dipilih untuk mencatat pengeluaran';
    END IF;
    IF get_user_role() NOT IN ('OWNER', 'FINANCE') THEN
      RAISE EXCEPTION 'Hanya OWNER atau FINANCE yang dapat mencatat pengeluaran pembelian material';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.cash_accounts
      WHERE id = p_cash_account_id AND organization_id = v_organization_id
    ) THEN
      RAISE EXCEPTION 'Rekening kas/bank tidak ditemukan di organisasi ini';
    END IF;
  END IF;

  v_purchase_date := COALESCE(p_purchase_date, now());
  v_total_price := p_quantity * p_unit_price + COALESCE(p_tax_amount, 0);

  IF COALESCE(p_create_expense, false) THEN
    INSERT INTO public.expenses (
      organization_id,
      number,
      date,
      merchant,
      description,
      amount,
      tax_amount,
      total_amount,
      payment_method,
      cash_account_id,
      category,
      project_id,
      source,
      status,
      submitted_by,
      notes
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
    organization_id,
    material_id,
    vendor_id,
    vendor_name,
    project_id,
    expense_id,
    purchase_date,
    document_number,
    quantity,
    unit,
    unit_price,
    tax_amount,
    total_price,
    notes,
    created_by
  ) VALUES (
    v_organization_id,
    p_material_id,
    p_vendor_id,
    trim(p_vendor_name),
    p_project_id,
    v_expense_id,
    v_purchase_date,
    NULLIF(trim(p_document_number), ''),
    p_quantity,
    trim(p_unit),
    p_unit_price,
    COALESCE(p_tax_amount, 0),
    v_total_price,
    p_notes,
    v_profile_id
  )
  RETURNING * INTO v_history;

  UPDATE public.master_materials
  SET standard_price = p_unit_price,
      min_price = CASE WHEN min_price = 0 OR p_unit_price < min_price THEN p_unit_price ELSE min_price END,
      max_price = CASE WHEN p_unit_price > max_price THEN p_unit_price ELSE max_price END,
      updated_at = now()
  WHERE id = p_material_id
    AND organization_id = v_organization_id;

  IF COALESCE(p_record_stock_movement, true) AND p_project_id IS NOT NULL THEN
    INSERT INTO public.material_stock_movements (
      organization_id,
      project_id,
      material_id,
      movement_type,
      date,
      quantity,
      unit,
      unit_price,
      total_cost,
      vendor_id,
      expense_id,
      reference_document,
      notes,
      created_by
    ) VALUES (
      v_organization_id,
      p_project_id,
      p_material_id,
      'RECEIPT',
      v_purchase_date,
      p_quantity,
      trim(p_unit),
      p_unit_price,
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

CREATE OR REPLACE FUNCTION public.pay_labor_claim(
  p_claim_id text,
  p_cash_account_id text,
  p_payment_date timestamptz,
  p_amount numeric,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_organization_id text;
  v_profile_id text;
  v_claim public.labor_claims%ROWTYPE;
  v_updated_claim public.labor_claims%ROWTYPE;
  v_cash_account public.cash_accounts%ROWTYPE;
  v_job_name text;
  v_payment_amount numeric(15, 2);
  v_total_paid numeric(15, 2);
  v_expense_id text;
  v_payment_date timestamptz;
BEGIN
  v_organization_id := get_user_organization_id();
  v_profile_id := auth.uid()::text;

  IF v_organization_id IS NULL OR v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF get_user_role() NOT IN ('OWNER', 'FINANCE') THEN
    RAISE EXCEPTION 'Hanya OWNER atau FINANCE yang dapat mencatat pembayaran upah';
  END IF;

  SELECT * INTO v_claim
  FROM public.labor_claims
  WHERE id = p_claim_id AND organization_id = v_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Klaim upah tidak ditemukan';
  END IF;
  IF v_claim.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'Klaim harus berstatus APPROVED sebelum dapat dibayarkan';
  END IF;

  v_payment_amount := COALESCE(p_amount, v_claim.approved_amount);
  IF v_payment_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pembayaran harus lebih besar dari 0';
  END IF;
  IF v_payment_amount > v_claim.approved_amount - COALESCE(v_claim.paid_amount, 0) THEN
    RAISE EXCEPTION 'Nominal pembayaran melebihi sisa klaim';
  END IF;

  SELECT * INTO v_cash_account
  FROM public.cash_accounts
  WHERE id = p_cash_account_id AND organization_id = v_organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rekening kas tidak ditemukan di organisasi ini';
  END IF;

  SELECT job_name INTO v_job_name
  FROM public.project_labor_items
  WHERE id = v_claim.labor_item_id
    AND project_id = v_claim.project_id
    AND organization_id = v_organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pekerjaan upah tidak ditemukan di proyek ini';
  END IF;

  v_payment_date := COALESCE(p_payment_date, now());
  INSERT INTO public.expenses (
    organization_id,
    number,
    date,
    merchant,
    description,
    amount,
    tax_amount,
    total_amount,
    payment_method,
    cash_account_id,
    category,
    project_id,
    source,
    status,
    submitted_by,
    notes
  ) VALUES (
    v_organization_id,
    'EXP-UPH-' || to_char(v_payment_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    v_payment_date,
    v_claim.mandor_name,
    'Pembayaran upah ' || v_claim.mandor_name || ' (' || COALESCE(v_job_name, 'Pekerjaan') || ') - Klaim #' || v_claim.claim_number,
    v_payment_amount,
    0,
    v_payment_amount,
    'TRANSFER',
    v_cash_account.id,
    'Upah Tukang',
    v_claim.project_id,
    'LABOR_CLAIM',
    'APPROVED',
    v_profile_id,
    p_notes
  )
  RETURNING id INTO v_expense_id;

  v_total_paid := COALESCE(v_claim.paid_amount, 0) + v_payment_amount;
  UPDATE public.labor_claims
  SET paid_amount = v_total_paid,
      status = CASE WHEN v_total_paid >= v_claim.approved_amount THEN 'PAID' ELSE 'APPROVED' END,
      expense_id = v_expense_id,
      updated_at = now()
  WHERE id = v_claim.id
    AND organization_id = v_organization_id
  RETURNING * INTO v_updated_claim;

  RETURN jsonb_build_object(
    'claim', to_jsonb(v_updated_claim),
    'expense_id', v_expense_id,
    'paid_amount', v_payment_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_material_purchase(text, text, text, text, timestamptz, text, numeric, text, numeric, numeric, text, boolean, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_material_purchase(text, text, text, text, timestamptz, text, numeric, text, numeric, numeric, text, boolean, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.pay_labor_claim(text, text, timestamptz, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_labor_claim(text, text, timestamptz, numeric, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
