-- TimeTravelDesign Finance - Project Cost Control, RAB, RAP, Upah Borongan & S-Curve Migration
-- Migration: 20261116_project_cost_control_rab_rap.sql

-- 1. Master Database Harga Upah (Labor Rates)
CREATE TABLE IF NOT EXISTS public.labor_rates (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_code text NOT NULL,
  job_name text NOT NULL,
  category text NOT NULL,
  description text,
  specifications text,
  unit text NOT NULL,
  payment_system text NOT NULL DEFAULT 'BORONGAN', -- BORONGAN | UPAH_KETENG | HARIAN
  standard_rate numeric(15, 2) NOT NULL DEFAULT 0,
  min_rate numeric(15, 2) NOT NULL DEFAULT 0,
  max_rate numeric(15, 2) NOT NULL DEFAULT 0,
  source text,
  effective_date timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT labor_rates_org_job_code_unique UNIQUE (organization_id, job_code)
);

CREATE INDEX IF NOT EXISTS labor_rates_org_cat_idx ON public.labor_rates (organization_id, category);

-- 2. Riwayat & Override Harga Upah (Labor Rate History)
CREATE TABLE IF NOT EXISTS public.labor_rate_history (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  labor_rate_id text NOT NULL REFERENCES public.labor_rates(id) ON DELETE CASCADE,
  project_id text REFERENCES public.projects(id) ON DELETE SET NULL,
  subcontractor_id text REFERENCES public.subcontractors(id) ON DELETE SET NULL,
  rate numeric(15, 2) NOT NULL DEFAULT 0,
  payment_system text,
  calculation_basis text,
  effective_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS labor_rate_history_org_rate_idx ON public.labor_rate_history (organization_id, labor_rate_id);
CREATE INDEX IF NOT EXISTS labor_rate_history_org_project_idx ON public.labor_rate_history (organization_id, project_id);

-- 3. Rekapitulasi Pekerjaan Upah Proyek (Project Labor Items)
CREATE TABLE IF NOT EXISTS public.project_labor_items (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subcontractor_id text REFERENCES public.subcontractors(id) ON DELETE SET NULL,
  labor_rate_id text REFERENCES public.labor_rates(id) ON DELETE SET NULL,
  mandor_name text NOT NULL,
  job_name text NOT NULL,
  category text NOT NULL,
  specifications text,
  unit text NOT NULL,
  payment_system text NOT NULL DEFAULT 'BORONGAN',
  contract_volume numeric(15, 4) NOT NULL DEFAULT 0,
  unit_rate numeric(15, 2) NOT NULL DEFAULT 0,
  total_amount numeric(15, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_labor_items_org_proj_idx ON public.project_labor_items (organization_id, project_id);

-- 4. Pengajuan & Klaim Upah Tukang (Labor Claims)
CREATE TABLE IF NOT EXISTS public.labor_claims (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  labor_item_id text NOT NULL REFERENCES public.project_labor_items(id) ON DELETE CASCADE,
  claim_number text NOT NULL,
  claim_date timestamptz NOT NULL DEFAULT now(),
  mandor_name text NOT NULL,
  work_description text,
  claimed_volume numeric(15, 4) NOT NULL DEFAULT 0,
  verified_volume numeric(15, 4) NOT NULL DEFAULT 0,
  approved_volume numeric(15, 4) NOT NULL DEFAULT 0,
  unit_rate numeric(15, 2) NOT NULL DEFAULT 0,
  claimed_amount numeric(15, 2) NOT NULL DEFAULT 0,
  approved_amount numeric(15, 2) NOT NULL DEFAULT 0,
  paid_amount numeric(15, 2) NOT NULL DEFAULT 0,
  supervisor_notes text,
  supporting_document_url text,
  status text NOT NULL DEFAULT 'SUBMITTED', -- DRAFT | SUBMITTED | VERIFIED | APPROVED | REJECTED | PAID
  verified_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  approved_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  rejection_reason text,
  expense_id text REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_by text NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT labor_claims_org_number_unique UNIQUE (organization_id, claim_number)
);

CREATE INDEX IF NOT EXISTS labor_claims_org_proj_idx ON public.labor_claims (organization_id, project_id);
CREATE INDEX IF NOT EXISTS labor_claims_org_item_idx ON public.labor_claims (organization_id, labor_item_id);

-- 5. Master Material (Master Materials)
CREATE TABLE IF NOT EXISTS public.master_materials (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  brand text,
  specification text,
  purchase_unit text NOT NULL,
  usage_unit text NOT NULL,
  conversion_factor numeric(15, 4) NOT NULL DEFAULT 1,
  standard_price numeric(15, 2) NOT NULL DEFAULT 0,
  min_price numeric(15, 2) NOT NULL DEFAULT 0,
  max_price numeric(15, 2) NOT NULL DEFAULT 0,
  waste_tolerance_percent numeric(5, 2) NOT NULL DEFAULT 5.00,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT master_materials_org_code_unique UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS master_materials_org_cat_idx ON public.master_materials (organization_id, category);

-- 6. Riwayat Harga Pembelian Material (Material Price History)
CREATE TABLE IF NOT EXISTS public.material_price_history (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  material_id text NOT NULL REFERENCES public.master_materials(id) ON DELETE CASCADE,
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name text NOT NULL,
  project_id text REFERENCES public.projects(id) ON DELETE SET NULL,
  expense_id text REFERENCES public.expenses(id) ON DELETE SET NULL,
  purchase_date timestamptz NOT NULL DEFAULT now(),
  document_number text,
  quantity numeric(15, 4) NOT NULL DEFAULT 1,
  unit text NOT NULL,
  unit_price numeric(15, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(15, 2) NOT NULL DEFAULT 0,
  total_price numeric(15, 2) NOT NULL DEFAULT 0,
  notes text,
  created_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS material_price_history_org_mat_idx ON public.material_price_history (organization_id, material_id);
CREATE INDEX IF NOT EXISTS material_price_history_org_vendor_idx ON public.material_price_history (organization_id, vendor_id);

-- 7. Kebutuhan Material Proyek (Project Materials)
CREATE TABLE IF NOT EXISTS public.project_materials (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  material_id text NOT NULL REFERENCES public.master_materials(id) ON DELETE CASCADE,
  planned_quantity numeric(15, 4) NOT NULL DEFAULT 0,
  unit text NOT NULL,
  budget_unit_price numeric(15, 2) NOT NULL DEFAULT 0,
  total_budget numeric(15, 2) NOT NULL DEFAULT 0,
  waste_tolerance_percent numeric(5, 2) NOT NULL DEFAULT 5.00,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_materials_project_material_unique UNIQUE (project_id, material_id)
);

CREATE INDEX IF NOT EXISTS project_materials_org_proj_idx ON public.project_materials (organization_id, project_id);

-- 8. Mutasi Stok Material (Material Stock Movements)
CREATE TABLE IF NOT EXISTS public.material_stock_movements (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  material_id text NOT NULL REFERENCES public.master_materials(id) ON DELETE CASCADE,
  movement_type text NOT NULL, -- PURCHASE | RECEIPT | ISSUED_TO_FIELD | USED | RETURN | TRANSFER | DAMAGED_WASTE | ADJUSTMENT
  date timestamptz NOT NULL DEFAULT now(),
  quantity numeric(15, 4) NOT NULL DEFAULT 0,
  unit text NOT NULL,
  unit_price numeric(15, 2) NOT NULL DEFAULT 0,
  total_cost numeric(15, 2) NOT NULL DEFAULT 0,
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  expense_id text REFERENCES public.expenses(id) ON DELETE SET NULL,
  target_project_id text REFERENCES public.projects(id) ON DELETE SET NULL,
  reference_document text,
  verified_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_by text NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mat_stock_org_proj_mat_idx ON public.material_stock_movements (organization_id, project_id, material_id);
CREATE INDEX IF NOT EXISTS mat_stock_org_date_idx ON public.material_stock_movements (organization_id, date);

-- 9. Master AHSP (Analisis Harga Satuan Pekerjaan)
CREATE TABLE IF NOT EXISTS public.master_ahsp (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  unit text NOT NULL,
  overhead_percent numeric(5, 2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT master_ahsp_org_code_unique UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS public.master_ahsp_components (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ahsp_id text NOT NULL REFERENCES public.master_ahsp(id) ON DELETE CASCADE,
  component_type text NOT NULL, -- MATERIAL | LABOR | EQUIPMENT | SUB_WORK
  material_id text REFERENCES public.master_materials(id) ON DELETE SET NULL,
  labor_rate_id text REFERENCES public.labor_rates(id) ON DELETE SET NULL,
  name text NOT NULL,
  coefficient numeric(15, 4) NOT NULL DEFAULT 1,
  unit text NOT NULL,
  unit_price numeric(15, 2) NOT NULL DEFAULT 0,
  subtotal numeric(15, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS master_ahsp_comp_ahsp_idx ON public.master_ahsp_components (ahsp_id);

-- 10. RAB Projects (Rencana Anggaran Biaya)
CREATE TABLE IF NOT EXISTS public.rab_projects (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  rab_number text NOT NULL,
  title text NOT NULL,
  client_name text,
  project_location text,
  date timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'DRAFT', -- DRAFT | SUBMITTED | APPROVED | REVISED | REJECTED
  is_locked boolean NOT NULL DEFAULT false,
  profit_type text NOT NULL DEFAULT 'MARKUP', -- MARKUP | GROSS_MARGIN
  profit_percentage numeric(5, 2) NOT NULL DEFAULT 20.00,
  overhead_percentage numeric(5, 2) NOT NULL DEFAULT 5.00,
  contingency_percentage numeric(5, 2) NOT NULL DEFAULT 0.00,
  tax_percentage numeric(5, 2) NOT NULL DEFAULT 0.00,
  total_material_hpp numeric(15, 2) NOT NULL DEFAULT 0,
  total_labor_hpp numeric(15, 2) NOT NULL DEFAULT 0,
  total_equipment_hpp numeric(15, 2) NOT NULL DEFAULT 0,
  total_hpp numeric(15, 2) NOT NULL DEFAULT 0,
  overhead_amount numeric(15, 2) NOT NULL DEFAULT 0,
  contingency_amount numeric(15, 2) NOT NULL DEFAULT 0,
  profit_amount numeric(15, 2) NOT NULL DEFAULT 0,
  subtotal_before_tax numeric(15, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(15, 2) NOT NULL DEFAULT 0,
  grand_total numeric(15, 2) NOT NULL DEFAULT 0,
  notes text,
  approved_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by text NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rab_projects_org_proj_ver_unique UNIQUE (organization_id, project_id, version),
  CONSTRAINT rab_projects_org_number_unique UNIQUE (organization_id, rab_number)
);

CREATE INDEX IF NOT EXISTS rab_projects_org_proj_idx ON public.rab_projects (organization_id, project_id);

CREATE TABLE IF NOT EXISTS public.rab_items (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rab_id text NOT NULL REFERENCES public.rab_projects(id) ON DELETE CASCADE,
  division text NOT NULL,
  sub_division text,
  item_code text,
  item_name text NOT NULL,
  unit text NOT NULL,
  volume numeric(15, 4) NOT NULL DEFAULT 1,
  material_unit_cost numeric(15, 2) NOT NULL DEFAULT 0,
  labor_unit_cost numeric(15, 2) NOT NULL DEFAULT 0,
  equipment_unit_cost numeric(15, 2) NOT NULL DEFAULT 0,
  unit_hpp numeric(15, 2) NOT NULL DEFAULT 0,
  total_hpp numeric(15, 2) NOT NULL DEFAULT 0,
  unit_price numeric(15, 2) NOT NULL DEFAULT 0,
  total_price numeric(15, 2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS rab_items_org_rab_idx ON public.rab_items (organization_id, rab_id);

CREATE TABLE IF NOT EXISTS public.rab_item_components (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rab_item_id text NOT NULL REFERENCES public.rab_items(id) ON DELETE CASCADE,
  component_type text NOT NULL, -- MATERIAL | LABOR | EQUIPMENT
  name text NOT NULL,
  coefficient numeric(15, 4) NOT NULL DEFAULT 1,
  unit text NOT NULL,
  unit_price numeric(15, 2) NOT NULL DEFAULT 0,
  subtotal numeric(15, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS rab_item_components_item_idx ON public.rab_item_components (rab_item_id);

-- 11. RAP Projects (Rencana Anggaran Pelaksanaan)
CREATE TABLE IF NOT EXISTS public.rap_projects (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  rab_id text REFERENCES public.rab_projects(id) ON DELETE SET NULL,
  rap_number text NOT NULL,
  title text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'DRAFT', -- DRAFT | APPROVED | ACTIVE | COMPLETED
  total_planned_budget numeric(15, 2) NOT NULL DEFAULT 0,
  target_savings numeric(15, 2) NOT NULL DEFAULT 0,
  notes text,
  created_by text NOT NULL REFERENCES public.profiles(id),
  approved_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rap_projects_org_proj_ver_unique UNIQUE (organization_id, project_id, version),
  CONSTRAINT rap_projects_org_number_unique UNIQUE (organization_id, rap_number)
);

CREATE INDEX IF NOT EXISTS rap_projects_org_proj_idx ON public.rap_projects (organization_id, project_id);

CREATE TABLE IF NOT EXISTS public.rap_items (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rap_id text NOT NULL REFERENCES public.rap_projects(id) ON DELETE CASCADE,
  rab_item_id text REFERENCES public.rab_items(id) ON DELETE SET NULL,
  division text NOT NULL,
  sub_division text,
  item_name text NOT NULL,
  unit text NOT NULL,
  volume numeric(15, 4) NOT NULL DEFAULT 1,
  target_material_cost numeric(15, 2) NOT NULL DEFAULT 0,
  target_labor_cost numeric(15, 2) NOT NULL DEFAULT 0,
  target_equipment_cost numeric(15, 2) NOT NULL DEFAULT 0,
  target_unit_price numeric(15, 2) NOT NULL DEFAULT 0,
  total_budget numeric(15, 2) NOT NULL DEFAULT 0,
  procurement_schedule text,
  execution_schedule text,
  pic_name text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS rap_items_rap_idx ON public.rap_items (rap_id);

-- 12. Bobot Pekerjaan & S-Curve (Project Schedules & Progress Records)
CREATE TABLE IF NOT EXISTS public.project_schedules (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  rap_item_id text REFERENCES public.rap_items(id) ON DELETE SET NULL,
  task_name text NOT NULL,
  division text NOT NULL,
  budget_amount numeric(15, 2) NOT NULL DEFAULT 0,
  weight_percentage numeric(7, 4) NOT NULL DEFAULT 0,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  duration_days integer NOT NULL DEFAULT 1,
  pic_name text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS project_schedules_org_proj_idx ON public.project_schedules (organization_id, project_id);

CREATE TABLE IF NOT EXISTS public.project_progress_records (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  schedule_id text NOT NULL REFERENCES public.project_schedules(id) ON DELETE CASCADE,
  record_date timestamptz NOT NULL DEFAULT now(),
  period_week integer NOT NULL DEFAULT 1,
  planned_progress_percent numeric(5, 2) NOT NULL DEFAULT 0,
  actual_progress_percent numeric(5, 2) NOT NULL DEFAULT 0,
  verified_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  notes text,
  created_by text NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proj_prog_org_proj_sched_idx ON public.project_progress_records (organization_id, project_id, schedule_id);
CREATE INDEX IF NOT EXISTS proj_prog_proj_week_idx ON public.project_progress_records (project_id, period_week);

-- 13. Quantity Takeoff & Dimensi Bangunan
CREATE TABLE IF NOT EXISTS public.project_takeoffs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  room_name text NOT NULL,
  length_m numeric(10, 3) NOT NULL DEFAULT 0,
  width_m numeric(10, 3) NOT NULL DEFAULT 0,
  height_m numeric(10, 3) NOT NULL DEFAULT 0,
  floor_area_m2 numeric(12, 3) NOT NULL DEFAULT 0,
  wall_perimeter_m numeric(12, 3) NOT NULL DEFAULT 0,
  wall_area_m2 numeric(12, 3) NOT NULL DEFAULT 0,
  ceiling_area_m2 numeric(12, 3) NOT NULL DEFAULT 0,
  door_window_area_m2 numeric(12, 3) NOT NULL DEFAULT 0,
  net_wall_area_m2 numeric(12, 3) NOT NULL DEFAULT 0,
  lighting_points integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_takeoffs_org_proj_idx ON public.project_takeoffs (organization_id, project_id);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.labor_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_labor_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_ahsp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_ahsp_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rab_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rab_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rab_item_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rap_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rap_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_progress_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_takeoffs ENABLE ROW LEVEL SECURITY;

-- POLICIES
DO $$
BEGIN
  -- View policies for all organization members
  EXECUTE 'DROP POLICY IF EXISTS "Org members view labor_rates" ON public.labor_rates';
  EXECUTE 'CREATE POLICY "Org members view labor_rates" ON public.labor_rates FOR SELECT USING (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org staff manage labor_rates" ON public.labor_rates';
  EXECUTE 'CREATE POLICY "Org staff manage labor_rates" ON public.labor_rates FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view labor_rate_history" ON public.labor_rate_history';
  EXECUTE 'CREATE POLICY "Org members view labor_rate_history" ON public.labor_rate_history FOR SELECT USING (organization_id = get_user_organization_id())';
  EXECUTE 'CREATE POLICY "Org staff manage labor_rate_history" ON public.labor_rate_history FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view project_labor_items" ON public.project_labor_items';
  EXECUTE 'CREATE POLICY "Org members view project_labor_items" ON public.project_labor_items FOR SELECT USING (organization_id = get_user_organization_id())';
  EXECUTE 'CREATE POLICY "Org staff manage project_labor_items" ON public.project_labor_items FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view labor_claims" ON public.labor_claims';
  EXECUTE 'CREATE POLICY "Org members view labor_claims" ON public.labor_claims FOR SELECT USING (organization_id = get_user_organization_id())';
  EXECUTE 'CREATE POLICY "Org staff manage labor_claims" ON public.labor_claims FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view master_materials" ON public.master_materials';
  EXECUTE 'CREATE POLICY "Org members view master_materials" ON public.master_materials FOR SELECT USING (organization_id = get_user_organization_id())';
  EXECUTE 'CREATE POLICY "Org staff manage master_materials" ON public.master_materials FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view material_price_history" ON public.material_price_history';
  EXECUTE 'CREATE POLICY "Org members view material_price_history" ON public.material_price_history FOR SELECT USING (organization_id = get_user_organization_id())';
  EXECUTE 'CREATE POLICY "Org staff manage material_price_history" ON public.material_price_history FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view project_materials" ON public.project_materials';
  EXECUTE 'CREATE POLICY "Org members view project_materials" ON public.project_materials FOR SELECT USING (organization_id = get_user_organization_id())';
  EXECUTE 'CREATE POLICY "Org staff manage project_materials" ON public.project_materials FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view material_stock_movements" ON public.material_stock_movements';
  EXECUTE 'CREATE POLICY "Org members view material_stock_movements" ON public.material_stock_movements FOR SELECT USING (organization_id = get_user_organization_id())';
  EXECUTE 'CREATE POLICY "Org staff manage material_stock_movements" ON public.material_stock_movements FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view master_ahsp" ON public.master_ahsp';
  EXECUTE 'CREATE POLICY "Org members view master_ahsp" ON public.master_ahsp FOR SELECT USING (organization_id = get_user_organization_id())';
  EXECUTE 'CREATE POLICY "Org staff manage master_ahsp" ON public.master_ahsp FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view master_ahsp_components" ON public.master_ahsp_components';
  EXECUTE 'CREATE POLICY "Org members view master_ahsp_components" ON public.master_ahsp_components FOR ALL USING (true) WITH CHECK (true)';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view rab_projects" ON public.rab_projects';
  EXECUTE 'CREATE POLICY "Org members view rab_projects" ON public.rab_projects FOR SELECT USING (organization_id = get_user_organization_id())';
  EXECUTE 'CREATE POLICY "Org staff manage rab_projects" ON public.rab_projects FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view rab_items" ON public.rab_items';
  EXECUTE 'CREATE POLICY "Org members view rab_items" ON public.rab_items FOR SELECT USING (organization_id = get_user_organization_id())';
  EXECUTE 'CREATE POLICY "Org staff manage rab_items" ON public.rab_items FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view rab_item_components" ON public.rab_item_components';
  EXECUTE 'CREATE POLICY "Org members view rab_item_components" ON public.rab_item_components FOR ALL USING (true) WITH CHECK (true)';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view rap_projects" ON public.rap_projects';
  EXECUTE 'CREATE POLICY "Org members view rap_projects" ON public.rap_projects FOR SELECT USING (organization_id = get_user_organization_id())';
  EXECUTE 'CREATE POLICY "Org staff manage rap_projects" ON public.rap_projects FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view rap_items" ON public.rap_items';
  EXECUTE 'CREATE POLICY "Org members view rap_items" ON public.rap_items FOR ALL USING (true) WITH CHECK (true)';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view project_schedules" ON public.project_schedules';
  EXECUTE 'CREATE POLICY "Org members view project_schedules" ON public.project_schedules FOR SELECT USING (organization_id = get_user_organization_id())';
  EXECUTE 'CREATE POLICY "Org staff manage project_schedules" ON public.project_schedules FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view project_progress_records" ON public.project_progress_records';
  EXECUTE 'CREATE POLICY "Org members view project_progress_records" ON public.project_progress_records FOR SELECT USING (organization_id = get_user_organization_id())';
  EXECUTE 'CREATE POLICY "Org staff manage project_progress_records" ON public.project_progress_records FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org members view project_takeoffs" ON public.project_takeoffs';
  EXECUTE 'CREATE POLICY "Org members view project_takeoffs" ON public.project_takeoffs FOR SELECT USING (organization_id = get_user_organization_id())';
  EXECUTE 'CREATE POLICY "Org staff manage project_takeoffs" ON public.project_takeoffs FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';
END $$;

NOTIFY pgrst, 'reload schema';
