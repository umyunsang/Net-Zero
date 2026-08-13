-- Versioned Thailand carbon-impact candidates selected for the presentation mock.
-- They remain production DRAFT and are only consumable through mock_demo approvals.
INSERT INTO factor_catalog (
  id, activity, code, version, value, unit, source_url, methodology_code,
  effective_at, assumptions, disclaimer_th, proxy_copy_th, status, is_synthetic
)
VALUES
  (
    'b0000000-0000-4000-8000-000000000011', 'tree', 'TREE_FIVE_YEAR_SURVIVAL_PROXY',
    'tver-s-tool-01-01-v2-bangkok-survival-v1', 9.500000000, 'kgCO2e/tree/year',
    'https://ghgreduction.tgo.or.th/th/tver-method/tver-tool/for-agr/download/12026/3451/31.html',
    'T-VER-S-TOOL-01-01-V02', '2026-08-13T00:00:00Z',
    '{"projection_years":"5","survival_factor":"0.63","quantity_basis":"one_verified_eligible_tree","eligibility":"tree meeting the cited TGO tree-count tool conditions","limitations":["future_projection","species_site_maintenance_variability","not_carbon_credit","no_permanence_claim"]}'::jsonb,
    'การดูดซับ 5 ปีเป็นค่าคาดการณ์ที่ปรับด้วยอัตรารอด ไม่ใช่คาร์บอนเครดิตหรือการรับรองโดย อบก.',
    'ใช้ 9.5 กก. CO₂ ต่อต้นต่อปี เป็นเวลา 5 ปี และปรับด้วยอัตรารอดที่สังเกตได้ 0.63',
    'draft', false
  ),
  (
    'b0000000-0000-4000-8000-000000000012', 'bus', 'DEMO_BUS_ROUTE_02',
    'tver-s-meth-03-02-v01-scheduled-bus-v1', 0.011200000, 'kgCO2/passenger-km',
    'https://tver.tgo.or.th/database/Uploads/Methodology/b51b3bf6-a51a-4b7e-a394-8743f44ff2fc.pdf',
    'T-VER-S-METH-03-02-V01', '2026-08-13T00:00:00Z',
    '{"car_factor":"0.127100000","car_factor_unit":"kgCO2/passenger-km","boundary":"operational_CO2","route_code":"DEMO-BUS-01","presentation_distance_km":"0.799211","limitations":["operational_CO2_only","synthetic_route_verification","not_carbon_credit"]}'::jsonb,
    'CO₂ ที่หลีกเลี่ยงเป็นการเปรียบเทียบช่วงใช้งานในระยะทางเดียวกัน ไม่ใช่คาร์บอนเครดิตหรือการรับรองโดย อบก.',
    'เปรียบเทียบรถยนต์ 0.12710 กับรถโดยสารประจำทาง 0.01120 กก. CO₂ ต่อคน-กม.',
    'draft', false
  ),
  (
    'b0000000-0000-4000-8000-000000000013', 'recycling', 'PET_BOTTLE_COUNT_PROXY_V2',
    'tver-s-meth-09-06-v02-thai-pet-v2', 0.038281237, 'kgCO2e/item',
    'https://tver.tgo.or.th/database/Uploads/Methodology/f6dac6a7-c83e-4bff-85d5-785ff8252f1a.pdf',
    'T-VER-S-METH-09-06-V02', '2026-08-13T00:00:00Z',
    '{"material":"plastic","resin":"PET","assumed_item_mass_kg":"0.029291707612064403","mass_basis":"4650 kg divided by 158748 Thai hospital PET bottles","qualifying_output_yield":"0.75","virgin_resin_factor_kgCO2e_per_kg":"2.9389","quality_factor":"0.75","recycling_electricity_kwh_per_kg":"0.83","thai_grid_factor_kgCO2e_per_kwh":"0.5562","collection_trip_leakage":"0","formula":"count × mass × yield × ((virgin factor × quality) − (electricity × grid factor))","limitations":["successful_recycling_assumed","count_to_mass_proxy","zero_mock_transport_leakage","PET_only","not_carbon_credit"]}'::jsonb,
    'ผลรีไซเคิลเป็นค่าประมาณสำหรับขวด PET ที่ถือว่ารีไซเคิลสำเร็จ ไม่ใช่คาร์บอนเครดิตหรือการรับรองโดย อบก.',
    'แปลงจำนวนขวด PET เป็นมวลและผลผลิตที่เข้าเกณฑ์ แล้วหักไฟฟ้ากระบวนการตามแนวทาง TGO',
    'draft', false
  )
ON CONFLICT (activity, code, version) DO UPDATE SET
  value=EXCLUDED.value, unit=EXCLUDED.unit, source_url=EXCLUDED.source_url,
  methodology_code=EXCLUDED.methodology_code, effective_at=EXCLUDED.effective_at,
  assumptions=EXCLUDED.assumptions, disclaimer_th=EXCLUDED.disclaimer_th,
  proxy_copy_th=EXCLUDED.proxy_copy_th
WHERE factor_catalog.status='draft';

INSERT INTO demo_factor_manifest_revisions(
  activity, factor_id, expected_material, supersedes_factor_id, effective_at
)
SELECT selected.activity, selected.factor_id, selected.expected_material,
       current.factor_id, '2026-08-13T00:00:00Z'::timestamptz
FROM (VALUES
  ('tree'::text,'b0000000-0000-4000-8000-000000000011'::uuid,NULL::text),
  ('bus'::text,'b0000000-0000-4000-8000-000000000012'::uuid,NULL::text),
  ('recycling'::text,'b0000000-0000-4000-8000-000000000013'::uuid,'plastic'::text)
) selected(activity,factor_id,expected_material)
JOIN current_demo_factor_manifest current ON current.activity=selected.activity
ON CONFLICT (factor_id) DO NOTHING;

INSERT INTO mock_demo_factor_approvals(
  factor_id, approval_scope, approved_by, approved_role, approved_at, is_mock, demo_only, reviewed_digest
)
SELECT factor.id, 'mock_demo', '44444444-4444-4444-8444-444444444444',
       'admin', '2026-08-13T00:00:00Z'::timestamptz, true, true, factor.review_digest
FROM factor_catalog factor
WHERE factor.id IN (
  'b0000000-0000-4000-8000-000000000011',
  'b0000000-0000-4000-8000-000000000012',
  'b0000000-0000-4000-8000-000000000013'
) AND factor.status='draft' AND factor.is_synthetic=false
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
       '2026-08-13T00:00:00Z'::timestamptz
FROM mock_demo_factor_approvals approval
JOIN factor_catalog factor ON factor.id=approval.factor_id
WHERE factor.id IN (
  'b0000000-0000-4000-8000-000000000011',
  'b0000000-0000-4000-8000-000000000012',
  'b0000000-0000-4000-8000-000000000013'
) AND NOT EXISTS (
  SELECT 1 FROM audit_events audit
  WHERE audit.event_type='factor.mock_demo_seeded' AND audit.subject_id=approval.factor_id
);
