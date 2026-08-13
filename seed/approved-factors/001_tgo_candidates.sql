-- These source-backed candidates remain DRAFT until the authenticated demo admin,
-- acting as project owner/domain reviewer, reviews every value, unit, source,
-- methodology, effective date, assumption, and Thai disclosure in the product.
-- The seed never grants approval and never creates carbon or points.

INSERT INTO factor_catalog (
  id, activity, code, version, value, unit, source_url, methodology_code,
  effective_at, assumptions, disclaimer_th, proxy_copy_th, status, is_synthetic
)
VALUES
  (
    'b0000000-0000-4000-8000-000000000001',
    'tree',
    'TREE_ONE_YEAR_PROXY',
    'tgo-public-info-9.5-v1',
    9.500000000,
    'kgCO2e/tree/year',
    'https://carbonmarket.tgo.or.th/index.php?action=ZGV0YWls&lang=TH&mod=aW5mb3JtYXRpb24%3D&param=NDc%3D',
    'TGO_PUBLIC_TREE_9_5',
    '2026-01-01T00:00:00Z',
    '{"time_basis":"one_year","quantity_basis":"one_verified_tree","limitations":["species","site","maintenance","environment","no_survival_claim","no_future_accrual"]}'::jsonb,
    'การกักเก็บหนึ่งปีที่คาดการณ์ไว้เป็นค่าประมาณ ไม่ใช่คาร์บอนเครดิตหรือการรับรองโดย อบก. และไม่ยืนยันการรอดของต้นไม้ในอนาคต',
    'ใช้ค่าอ้างอิง 9.5 กก. CO₂ ต่อต้นต่อปีเป็นพร็อกซีหนึ่งปี โดยผลจริงขึ้นกับชนิด พื้นที่ การดูแล และสิ่งแวดล้อม',
    'draft',
    false
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'bus',
    'DEMO_BUS_ROUTE_01',
    'tver-tm-06-v03-demo-route-v1',
    0.090000000,
    'kgCO2/passenger-km',
    'https://tver.tgo.or.th/database/Uploads/Methodology/ab922262-8b11-47d8-9c8e-80a77feb88db.pdf',
    'T-VER-METH-TM-06-V03',
    '2026-01-01T00:00:00Z',
    '{"car_factor":"0.127100000","car_factor_unit":"kgCO2/passenger-km","bus_factor_basis":"route-level demo proxy within cited TGO project range","route_code":"DEMO-BUS-01","limitations":["heuristic_trip_verification","not_scientifically_validated","not_fraud_proof","CO2_not_full_CO2e_inventory"]}'::jsonb,
    'CO₂ ที่หลีกเลี่ยงเป็นค่าประมาณจากระยะทางและปัจจัยอ้างอิง ไม่ใช่คาร์บอนเครดิตหรือการรับรองโดย อบก. กติกาตรวจการเดินทางเป็นฮิวริสติกของ MVP',
    'เปรียบเทียบปัจจัยรถยนต์นั่งส่วนบุคคล 0.12710 กับพร็อกซีเส้นทางรถโดยสารสาธิต 0.09000 กก. CO₂ ต่อคน-กม.',
    'draft',
    false
  ),
  (
    'b0000000-0000-4000-8000-000000000003',
    'recycling',
    'PET_BOTTLE_COUNT_PROXY',
    'tver-s-meth-09-06-v02-pet-count-v1',
    0.044083500,
    'kgCO2e/item',
    'https://tver.tgo.or.th/database/Uploads/Methodology/9511273e-7cd5-4317-bbf8-1d19046f41e7.pdf',
    'T-VER-S-METH-09-06-V02',
    '2026-01-01T00:00:00Z',
    '{"material":"plastic","resin":"PET","assumed_item_mass_kg":"0.020000000","virgin_resin_factor_kgCO2e_per_kg":"2.938900000","quality_loss_factor":"0.750000000","formula":"count × 0.020 × 2.9389 × 0.75","limitations":["delivery_evidence_only","item_mass_proxy","project_emissions_and_leakage_not_measured","plastic_only"]}'::jsonb,
    'ผลรีไซเคิลเป็นค่าประมาณจากจำนวนชิ้นและพร็อกซีน้ำหนัก หลักฐานยืนยันเพียงการนำส่ง ไม่ยืนยันว่ากระบวนการรีไซเคิลสำเร็จ และไม่ใช่คาร์บอนเครดิตหรือการรับรองโดย อบก.',
    'ขวด PET หนึ่งชิ้นสมมติน้ำหนัก 0.020 กก. และใช้ปัจจัยพร็อกซีตามสูตรที่ระบุ โดยยังไม่หักการปล่อยจากกระบวนการและการขนส่ง',
    'draft',
    false
  )
ON CONFLICT (activity, code, version) DO UPDATE SET
  value = EXCLUDED.value,
  unit = EXCLUDED.unit,
  source_url = EXCLUDED.source_url,
  methodology_code = EXCLUDED.methodology_code,
  effective_at = EXCLUDED.effective_at,
  assumptions = EXCLUDED.assumptions,
  disclaimer_th = EXCLUDED.disclaimer_th,
  proxy_copy_th = EXCLUDED.proxy_copy_th
WHERE factor_catalog.status = 'draft';

INSERT INTO demo_factor_manifest(activity, factor_id, expected_material)
VALUES
  ('tree', 'b0000000-0000-4000-8000-000000000001', NULL),
  ('bus', 'b0000000-0000-4000-8000-000000000002', NULL),
  ('recycling', 'b0000000-0000-4000-8000-000000000003', 'plastic')
ON CONFLICT (activity) DO NOTHING;

-- These are structurally scoped mock/demo approvals. They do not change
-- factor_catalog.status and cannot be consumed by production claims.
INSERT INTO mock_demo_factor_approvals(
  factor_id, approval_scope, approved_by, approved_role, approved_at, is_mock, demo_only, reviewed_digest
)
SELECT manifest.factor_id, 'mock_demo', '44444444-4444-4444-8444-444444444444',
       'admin', '2026-01-01T00:00:00Z'::timestamptz, true, true, factor.review_digest
FROM demo_factor_manifest manifest
JOIN factor_catalog factor ON factor.id=manifest.factor_id
WHERE factor.status='draft' AND factor.is_synthetic=false
ON CONFLICT (factor_id) DO NOTHING;

INSERT INTO audit_events(actor_id,event_type,subject_type,subject_id,metadata,created_at)
SELECT approval.approved_by,'factor.mock_demo_seeded','factor',approval.factor_id,
       jsonb_build_object(
         'data_scope','mock_demo','is_mock',true,'demo_only',true,
         'approval_scope',approval.approval_scope,'reviewed_digest',approval.reviewed_digest,
         'correlation_id','mock-demo:FIXTURE-BKK-20260812-01',
         'actor_role',approval.approved_role::text,'activity',factor.activity,
         'factor_version',factor.version,'fixture_id','FIXTURE-BKK-20260812-01',
         'outcome','fixture_review_recorded'
       ),
       '2026-01-01T00:00:00Z'::timestamptz
FROM mock_demo_factor_approvals approval
JOIN factor_catalog factor ON factor.id=approval.factor_id
WHERE NOT EXISTS (
  SELECT 1 FROM audit_events audit
  WHERE audit.event_type='factor.mock_demo_seeded' AND audit.subject_id=approval.factor_id
);
-- These source-backed candidates remain DRAFT for production. The seed records
-- a deterministic mock_demo review by the demo admin for hackathon execution
-- only; it never grants production/TGO approval or creates carbon or points.
-- Deterministic mock-demo fixtures. The candidates remain production DRAFT,
-- while the separate mock_demo_factor_approvals rows record automated fixture
-- review for demo-only calculations. This is not human/TGO approval and this
-- seed never creates carbon or point ledger entries.
