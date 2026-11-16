import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const env = Object.fromEntries(readFileSync(".env", "utf8").split(/\r?\n/).map((line) => {
  const index = line.indexOf("=");
  return index < 0
    ? ["", ""]
    : [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^"|"$/g, "")];
}));
const supabaseUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
const databaseUrl = new URL(env.DATABASE_URL);
if (
  supabaseUrl.hostname !== "vsqihhnlteuimwrhvqcx.supabase.co" ||
  databaseUrl.hostname !== "aws-0-ap-northeast-1.pooler.supabase.com"
) {
  throw new Error("Configured database target changed; the rollback-only test was not run.");
}

const ids = Object.fromEntries([
  "org", "otherOrg", "user", "project", "otherProject", "cash", "vendorA", "vendorB", "vendorC",
  "material", "ahsp", "otherAhsp", "otherAhspComponent", "rab", "rap", "rabItemA", "rabItemB", "laborItem", "claim", "rate", "scheduleA", "scheduleB",
].map((key) => [key, randomUUID()]));
const progressValues = [];
for (let week = 1; week <= 12; week += 1) {
  for (const [scheduleId, progress] of [
    [ids.scheduleA, week * (100 / 12)],
    [ids.scheduleB, week * 5],
  ]) {
    progressValues.push(
      `('${randomUUID()}','${ids.org}','${ids.project}','${scheduleId}',` +
      `'2026-03-${String(week + 1).padStart(2, "0")}T00:00:00Z',${week},` +
      `${(week * (100 / 12)).toFixed(4)},${progress.toFixed(4)},'${ids.user}',now(),'${ids.user}')`,
    );
  }
}

const sql = `
\\o /dev/null
BEGIN;
INSERT INTO organizations (id,name) VALUES
  ('${ids.org}','TEST ONLY Cost Control E2E ${ids.org.slice(0, 8)}'),
  ('${ids.otherOrg}','TEST ONLY Cross Tenant ${ids.otherOrg.slice(0, 8)}');
INSERT INTO profiles (id,email,full_name,updated_at)
  VALUES ('${ids.user}','e2e-${ids.user.slice(0, 8)}@example.invalid','Testing Owner',now());
INSERT INTO organization_members (organization_id,profile_id,role)
  VALUES ('${ids.org}','${ids.user}','OWNER');
INSERT INTO projects (id,organization_id,code,name,status,type,contract_value,start_date,end_date,updated_at) VALUES
  ('${ids.project}','${ids.org}','E2E-${ids.project.slice(0, 8)}','Renovasi Interior Rumah Contoh','ACTIVE','RENOVATION',500000000,'2026-01-05','2026-03-30',now()),
  ('${ids.otherProject}','${ids.otherOrg}','E2E-${ids.otherProject.slice(0, 8)}','Other Tenant Project','ACTIVE','RENOVATION',1000000,'2026-01-05','2026-03-30',now());
INSERT INTO vendors (id,organization_id,name,updated_at) VALUES
  ('${ids.vendorA}','${ids.org}','Supplier Ceramic A',now()),
  ('${ids.vendorB}','${ids.org}','Supplier Ceramic B',now()),
  ('${ids.vendorC}','${ids.org}','Supplier Ceramic C',now());
INSERT INTO cash_accounts (id,organization_id,name,type,opening_balance,opening_date)
  VALUES ('${ids.cash}','${ids.org}','E2E Test Bank','BANK',10000000,'2026-01-01');
INSERT INTO master_materials (id,organization_id,code,name,category,purchase_unit,usage_unit,conversion_factor,standard_price,min_price,max_price)
  VALUES ('${ids.material}','${ids.org}','E2E-TILE','Keramik 60x60 Test','Lantai','dus','m²',1.44,195000,180000,220000);
INSERT INTO master_ahsp (id,organization_id,code,name,category,unit)
  VALUES
    ('${ids.ahsp}','${ids.org}','E2E-AHSP','Test AHSP','Lantai','m²'),
    ('${ids.otherAhsp}','${ids.otherOrg}','OTHER-AHSP','Other Tenant AHSP','Lantai','m²');
INSERT INTO master_ahsp_components (id,ahsp_id,component_type,name,coefficient,unit,unit_price,subtotal)
  VALUES ('${ids.otherAhspComponent}','${ids.otherAhsp}','MATERIAL','Other Tenant Component',1,'m²',1,1);
INSERT INTO rab_projects (id,organization_id,project_id,rab_number,title,status,is_locked,created_by)
  VALUES ('${ids.rab}','${ids.org}','${ids.project}','E2E-RAB-${ids.rab.slice(0, 8)}','E2E Frozen RAB','DRAFT',false,'${ids.user}');
INSERT INTO rab_items (id,organization_id,rab_id,division,item_name,unit,volume,material_unit_cost,labor_unit_cost,equipment_unit_cost,unit_hpp,total_hpp,unit_price,total_price,sort_order) VALUES
  ('${ids.rabItemA}','${ids.org}','${ids.rab}','Lantai','Pemasangan keramik 60x60','m²',120,100000,75000,5000,180000,21600000,180000,21600000,1),
  ('${ids.rabItemB}','${ids.org}','${ids.rab}','Finishing','Pekerjaan pembulatan test','unit',1,0.01,0.01,0,0.02,0.02,0.02,0.02,2);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','${ids.user}',true);
SELECT set_config('request.jwt.claims','{"sub":"${ids.user}","role":"authenticated"}',true);
DO $$ DECLARE visible_count integer; rejected boolean := false; BEGIN
  SELECT count(*) INTO visible_count FROM master_ahsp_components WHERE id='${ids.otherAhspComponent}';
  IF visible_count <> 0 THEN RAISE EXCEPTION 'Assertion failed: cross-tenant AHSP component visible'; END IF;
  BEGIN
    INSERT INTO master_ahsp_components (ahsp_id,component_type,name,unit)
      VALUES ('${ids.otherAhsp}','MATERIAL','Cross Tenant Write','m²');
  EXCEPTION WHEN OTHERS THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Assertion failed: cross-tenant AHSP component write accepted'; END IF;
END $$;

SELECT public.record_material_purchase('${ids.material}','${ids.vendorA}','Supplier Ceramic A','${ids.project}','2026-01-10','PO-E2E-1',4,'dus',195000,0,'Paid order',true,true,'${ids.cash}');
SELECT public.record_material_purchase('${ids.material}','${ids.vendorB}','Supplier Ceramic B','${ids.project}','2026-01-11','PO-E2E-2',1,'dus',200000,0,'Unpaid purchase',true,false,NULL);
SELECT public.record_material_purchase('${ids.material}','${ids.vendorC}','Supplier Ceramic C','${ids.project}','2026-01-12','PO-E2E-3',1,'dus',210000,0,'Unpaid supplier comparison',true,false,NULL);
DO $$ BEGIN
  IF (SELECT count(*) FROM material_price_history WHERE project_id='${ids.project}' AND material_id='${ids.material}') <> 3 THEN
    RAISE EXCEPTION 'Assertion failed: purchase history count';
  END IF;
  IF (SELECT count(*) FROM expenses WHERE project_id='${ids.project}' AND source='MATERIAL_PURCHASE') <> 1 THEN
    RAISE EXCEPTION 'Assertion failed: unpaid material purchase was booked as cash expense';
  END IF;
  IF (SELECT sum(quantity) FROM material_stock_movements WHERE project_id='${ids.project}' AND material_id='${ids.material}' AND movement_type='RECEIPT') <> 8.64 THEN
    RAISE EXCEPTION 'Assertion failed: purchase unit conversion to usage unit';
  END IF;
END $$;

SELECT public.recalculate_rab_project('${ids.rab}','MARKUP',20,10,5,0);
DO $$ BEGIN
  IF (SELECT grand_total FROM rab_projects WHERE id='${ids.rab}') <> 29808000.02 THEN
    RAISE EXCEPTION 'Assertion failed: markup RAB total';
  END IF;
END $$;
SELECT public.recalculate_rab_project('${ids.rab}','GROSS_MARGIN',20,10,5,0);
DO $$ BEGIN
  IF (SELECT grand_total FROM rab_projects WHERE id='${ids.rab}') <> 31050000.03 THEN
    RAISE EXCEPTION 'Assertion failed: gross margin RAB total';
  END IF;
  IF (SELECT sum(total_price) FROM rab_items WHERE rab_id='${ids.rab}') <> 31050000.03 THEN
    RAISE EXCEPTION 'Assertion failed: RAB line total reconciliation';
  END IF;
END $$;
UPDATE rab_projects SET status='APPROVED',is_locked=true,approved_by='${ids.user}',approved_at=now()
  WHERE id='${ids.rab}' AND organization_id='${ids.org}';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM rab_projects WHERE id='${ids.rab}' AND status='APPROVED' AND is_locked) THEN
    RAISE EXCEPTION 'Assertion failed: RAB approval and lock did not persist';
  END IF;
END $$;
UPDATE master_materials SET standard_price=205000 WHERE id='${ids.material}' AND organization_id='${ids.org}';
SELECT public.create_rap_from_rab('${ids.rab}','E2E-RAP-${ids.rap.slice(0, 8)}',5);
DO $$ BEGIN
  IF (SELECT grand_total FROM rab_projects WHERE id='${ids.rab}') <> 31050000.03 THEN
    RAISE EXCEPTION 'Assertion failed: locked RAB changed with master price';
  END IF;
  IF (SELECT total_planned_budget FROM rap_projects WHERE rab_id='${ids.rab}') <> 20520000.02 THEN
    RAISE EXCEPTION 'Assertion failed: RAP budget calculation';
  END IF;
  IF (SELECT sum(total_budget) FROM rap_items item JOIN rap_projects rap ON rap.id=item.rap_id WHERE rap.rab_id='${ids.rab}') <> 20520000.02 THEN
    RAISE EXCEPTION 'Assertion failed: RAP item total reconciliation';
  END IF;
END $$;

INSERT INTO project_materials (organization_id,project_id,material_id,planned_quantity,unit,budget_unit_price,total_budget,waste_tolerance_percent)
  VALUES ('${ids.org}','${ids.project}','${ids.material}',6,'m²',142361.11,854166.66,5);
INSERT INTO material_stock_movements (organization_id,project_id,material_id,movement_type,date,quantity,unit,unit_price,total_cost,vendor_id,created_by,verified_by) VALUES
  ('${ids.org}','${ids.project}','${ids.material}','ISSUED_TO_FIELD','2026-01-12',5,'m²',138888.89,694444.45,'${ids.vendorA}','${ids.user}',NULL),
  ('${ids.org}','${ids.project}','${ids.material}','USED','2026-01-13',4.2,'m²',138888.89,583333.34,'${ids.vendorA}','${ids.user}','${ids.user}'),
  ('${ids.org}','${ids.project}','${ids.material}','RETURN','2026-01-14',0.3,'m²',138888.89,41666.67,'${ids.vendorB}','${ids.user}',NULL),
  ('${ids.org}','${ids.project}','${ids.material}','DAMAGED_WASTE','2026-01-15',0.1,'m²',138888.89,13888.89,'${ids.vendorA}','${ids.user}',NULL);
INSERT INTO project_schedules (id,organization_id,project_id,task_name,division,budget_amount,weight_percentage,start_date,end_date,duration_days,sort_order) VALUES
  ('${ids.scheduleA}','${ids.org}','${ids.project}','Lantai','Finishing',200000000,40,'2026-01-05','2026-03-30',84,1),
  ('${ids.scheduleB}','${ids.org}','${ids.project}','Instalasi','MEP',300000000,60,'2026-01-05','2026-03-30',84,2);
INSERT INTO project_progress_records (id,organization_id,project_id,schedule_id,record_date,period_week,planned_progress_percent,actual_progress_percent,verified_by,verified_at,created_by)
  VALUES ${progressValues.join(",")};

INSERT INTO project_labor_items (id,organization_id,project_id,mandor_name,job_name,category,unit,payment_system,contract_volume,unit_rate,total_amount,status,updated_at)
  VALUES ('${ids.laborItem}','${ids.org}','${ids.project}','Mandor Keramik','Pasang Keramik','Finishing','m²','BORONGAN',120,75000,9000000,'ACTIVE',now());
INSERT INTO labor_claims (id,organization_id,project_id,labor_item_id,claim_number,claim_date,mandor_name,claimed_volume,verified_volume,approved_volume,unit_rate,claimed_amount,approved_amount,paid_amount,status,created_by)
  VALUES ('${ids.claim}','${ids.org}','${ids.project}','${ids.laborItem}','E2E-CLAIM-${ids.claim.slice(0, 8)}','2026-01-16','Mandor Keramik',10,8,8,75000,750000,600000,0,'APPROVED','${ids.user}');
SELECT public.pay_labor_claim('${ids.claim}','${ids.cash}','2026-01-17',250000,'Part 1');
SELECT public.pay_labor_claim('${ids.claim}','${ids.cash}','2026-01-18',350000,'Part 2');
DO $$ DECLARE rejected boolean := false; BEGIN
  BEGIN
    PERFORM public.pay_labor_claim('${ids.claim}','${ids.cash}',now(),1,'Overpay test');
  EXCEPTION WHEN OTHERS THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Assertion failed: overpayment was accepted'; END IF;
END $$;

DO $$ DECLARE rejected boolean := false; BEGIN
  BEGIN
    INSERT INTO material_stock_movements (organization_id,project_id,material_id,movement_type,date,quantity,unit,created_by)
      VALUES ('${ids.org}','${ids.project}','${ids.material}','USED',now(),1,'dus','${ids.user}');
  EXCEPTION WHEN OTHERS THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Assertion failed: invalid stock unit was accepted'; END IF;
END $$;
DO $$ DECLARE visible_count integer; BEGIN
  SELECT count(*) INTO visible_count FROM projects WHERE id='${ids.otherProject}';
  IF visible_count <> 0 THEN RAISE EXCEPTION 'Assertion failed: cross-tenant project visible'; END IF;
END $$;

RESET ROLE;
UPDATE organization_members SET role='FINANCE' WHERE organization_id='${ids.org}' AND profile_id='${ids.user}';
SET LOCAL ROLE authenticated;
INSERT INTO labor_rates (id,organization_id,job_code,job_name,category,unit,standard_rate,min_rate,max_rate,created_at,updated_at)
  VALUES ('${ids.rate}','${ids.org}','E2E-RATE','E2E Labor Rate','Finishing','m²',80000,75000,90000,now(),now());
RESET ROLE;
UPDATE organization_members SET role='PROJECT_MANAGER' WHERE organization_id='${ids.org}' AND profile_id='${ids.user}';
SET LOCAL ROLE authenticated;
UPDATE project_labor_items SET notes='PROJECT_MANAGER permission test' WHERE id='${ids.laborItem}' AND organization_id='${ids.org}';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM project_labor_items WHERE id='${ids.laborItem}' AND notes='PROJECT_MANAGER permission test') THEN
    RAISE EXCEPTION 'Assertion failed: PROJECT_MANAGER could not update project labor contract';
  END IF;
END $$;
RESET ROLE;
UPDATE organization_members SET role='SITE_STAFF' WHERE organization_id='${ids.org}' AND profile_id='${ids.user}';
SET LOCAL ROLE authenticated;
DO $$ DECLARE rejected boolean := false; BEGIN
  BEGIN
    PERFORM public.create_rap_from_rab('${ids.rab}','E2E-RAP-DENIED-${ids.rap.slice(0, 8)}',5);
  EXCEPTION WHEN OTHERS THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Assertion failed: SITE_STAFF created RAP'; END IF;
END $$;
DO $$ DECLARE rejected boolean := false; BEGIN
  BEGIN
    INSERT INTO master_materials (organization_id,code,name,category,purchase_unit,usage_unit,conversion_factor)
      VALUES ('${ids.org}','E2E-DENIED','Denied','Test','unit','unit',1);
  EXCEPTION WHEN OTHERS THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Assertion failed: SITE_STAFF created master material'; END IF;
END $$;
DO $$ DECLARE rejected boolean := false; BEGIN
  BEGIN
    INSERT INTO project_progress_records (organization_id,project_id,schedule_id,record_date,period_week,actual_progress_percent,verified_by,verified_at,created_by)
      VALUES ('${ids.org}','${ids.project}','${ids.scheduleA}',now(),13,1,'${ids.user}',now(),'${ids.user}');
  EXCEPTION WHEN OTHERS THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Assertion failed: SITE_STAFF verified progress'; END IF;
END $$;
INSERT INTO labor_claims (organization_id,project_id,labor_item_id,claim_number,mandor_name,claimed_volume,verified_volume,approved_volume,unit_rate,claimed_amount,approved_amount,paid_amount,status,created_by)
  VALUES ('${ids.org}','${ids.project}','${ids.laborItem}','E2E-SITE-${ids.claim.slice(0, 8)}','Mandor Keramik',1,0,0,75000,75000,0,0,'SUBMITTED','${ids.user}');
DO $$ BEGIN
  IF (SELECT verified_volume FROM labor_claims WHERE claim_number='E2E-SITE-${ids.claim.slice(0, 8)}') <> 0 THEN
    RAISE EXCEPTION 'Assertion failed: submitted claim was pre-verified';
  END IF;
END $$;
RESET ROLE;
UPDATE organization_members SET role='VIEWER' WHERE organization_id='${ids.org}' AND profile_id='${ids.user}';
SET LOCAL ROLE authenticated;
DO $$ DECLARE rejected boolean := false; BEGIN
  BEGIN
    INSERT INTO labor_claims (organization_id,project_id,labor_item_id,claim_number,mandor_name,claimed_volume,verified_volume,approved_volume,unit_rate,claimed_amount,approved_amount,paid_amount,status,created_by)
      VALUES ('${ids.org}','${ids.project}','${ids.laborItem}','E2E-VIEWER-${ids.claim.slice(0, 8)}','Mandor Keramik',1,0,0,75000,75000,0,0,'SUBMITTED','${ids.user}');
  EXCEPTION WHEN OTHERS THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Assertion failed: VIEWER submitted a labor claim'; END IF;
END $$;
DO $$ DECLARE rejected boolean := false; BEGIN
  BEGIN
    INSERT INTO master_materials (organization_id,code,name,category,purchase_unit,usage_unit,conversion_factor)
      VALUES ('${ids.org}','E2E-VIEWER','Denied','Test','unit','unit',1);
  EXCEPTION WHEN OTHERS THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Assertion failed: VIEWER created master material'; END IF;
END $$;
RESET ROLE;

\\o
SELECT jsonb_build_object(
  'project', (SELECT name FROM projects WHERE id='${ids.project}'),
  'material_paid_expense_count', (SELECT count(*) FROM expenses WHERE project_id='${ids.project}' AND source='MATERIAL_PURCHASE'),
  'material_history_purchase_count', (SELECT count(*) FROM material_price_history WHERE project_id='${ids.project}' AND material_id='${ids.material}'),
  'material_purchased_dus', (SELECT sum(quantity) FROM material_price_history WHERE project_id='${ids.project}' AND material_id='${ids.material}'),
  'material_price_min', (SELECT min(unit_price) FROM material_price_history WHERE project_id='${ids.project}' AND material_id='${ids.material}'),
  'material_price_max', (SELECT max(unit_price) FROM material_price_history WHERE project_id='${ids.project}' AND material_id='${ids.material}'),
  'material_receipts_m2', (SELECT sum(quantity) FROM material_stock_movements WHERE project_id='${ids.project}' AND material_id='${ids.material}' AND movement_type='RECEIPT'),
  'material_verified_used_m2', (SELECT sum(quantity) FROM material_stock_movements WHERE project_id='${ids.project}' AND material_id='${ids.material}' AND movement_type='USED' AND verified_by='${ids.user}'),
  'cash_expense_total', (SELECT sum(total_amount) FROM expenses WHERE cash_account_id='${ids.cash}' AND status IN ('APPROVED','POSTED')),
  'cash_balance_after', (SELECT opening_balance - (SELECT coalesce(sum(total_amount),0) FROM expenses WHERE cash_account_id='${ids.cash}' AND status IN ('APPROVED','POSTED')) FROM cash_accounts WHERE id='${ids.cash}'),
  'labor_paid_total', (SELECT paid_amount FROM labor_claims WHERE id='${ids.claim}'),
  'labor_payment_expenses', (SELECT count(*) FROM expenses WHERE project_id='${ids.project}' AND source='LABOR_CLAIM'),
  'labor_claim_rows', (SELECT count(*) FROM labor_claims WHERE project_id='${ids.project}'),
  'role_matrix_checked', 5,
  'weekly_progress_rows', (SELECT count(*) FROM project_progress_records WHERE project_id='${ids.project}'),
  'schedule_weight_total', (SELECT sum(weight_percentage) FROM project_schedules WHERE project_id='${ids.project}'),
  'rab_locked_total', (SELECT grand_total FROM rab_projects WHERE id='${ids.rab}'),
  'rab_item_total_sum', (SELECT sum(total_price) FROM rab_items WHERE rab_id='${ids.rab}'),
  'rap_total', (SELECT total_planned_budget FROM rap_projects WHERE rab_id='${ids.rab}'),
  'rap_item_total_sum', (SELECT sum(total_budget) FROM rap_items item JOIN rap_projects rap ON rap.id=item.rap_id WHERE rap.rab_id='${ids.rab}')
);
ROLLBACK;
`;

const result = spawnSync(
  "/opt/homebrew/opt/postgresql@14/bin/psql",
  [
    "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--quiet", "--tuples-only", "--no-align",
    "--host", databaseUrl.hostname, "--port", databaseUrl.port || "5432",
    "--username", decodeURIComponent(databaseUrl.username),
    "--dbname", decodeURIComponent(databaseUrl.pathname.slice(1)),
  ],
  {
    input: sql,
    env: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(databaseUrl.password),
      PGSSLMODE: databaseUrl.searchParams.get("sslmode") || "require",
    },
    encoding: "utf8",
  },
);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status || 1);
console.log("Rollback-only cost-control integration assertions passed.");
