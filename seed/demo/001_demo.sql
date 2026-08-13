-- Deterministic, visibly isolated hackathon fixtures. No factor is approved here.
INSERT INTO users (id, email, display_name, role, is_demo)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'demo.user@netzero.local', 'ผู้ใช้สาธิต', 'user', true),
  ('22222222-2222-4222-8222-222222222222', 'demo.reviewer@netzero.local', 'ผู้ตรวจสอบสาธิต', 'reviewer', true),
  ('33333333-3333-4333-8333-333333333333', 'demo.merchant@netzero.local', 'ร้านค้าสาธิต', 'merchant', true),
  ('44444444-4444-4444-8444-444444444444', 'demo.admin@netzero.local', 'ผู้ดูแลสาธิต', 'admin', true)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  is_demo = true;

INSERT INTO user_preferences (user_id, leaderboard_opt_in, leaderboard_pseudonym)
VALUES ('11111111-1111-4111-8111-111111111111', true, 'ผู้ใช้-ใบไม้-1001')
ON CONFLICT (user_id) DO UPDATE SET
  leaderboard_opt_in = EXCLUDED.leaderboard_opt_in,
  leaderboard_pseudonym = EXCLUDED.leaderboard_pseudonym,
  updated_at = now();

INSERT INTO point_balances (user_id, balance)
SELECT id, 0 FROM users WHERE is_demo = true
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO merchants (id, user_id, name, is_demo, active)
VALUES ('55555555-5555-4555-8555-555555555555', '33333333-3333-4333-8333-333333333333', 'ร้านค้าร่วมสาธิต', true, true)
ON CONFLICT (id) DO UPDATE SET active = true, is_demo = true;

INSERT INTO rewards (id, merchant_id, title_th, point_cost, active, is_demo)
VALUES
  ('66666666-6666-4666-8666-666666666661', '55555555-5555-4555-8555-555555555555', 'ส่วนลดสินค้า 20 บาท (สาธิต)', 20, true, true),
  ('66666666-6666-4666-8666-666666666662', '55555555-5555-4555-8555-555555555555', 'ส่วนลดเครื่องดื่ม 40 บาท (สาธิต)', 40, true, true)
ON CONFLICT (id) DO UPDATE SET active = true, is_demo = true;

INSERT INTO qr_bins (id, code, location, is_demo, active)
VALUES (
  '77777777-7777-4777-8777-777777777777',
  'DEMO-BIN-BKK-01',
  ST_SetSRID(ST_MakePoint(100.53830, 13.76490), 4326)::geography,
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET active = true, is_demo = true;

INSERT INTO qr_tokens (token_hash, bin_id, is_demo, expires_at, issued_at)
SELECT
  encode(digest(token_value, 'sha256'), 'hex'),
  '77777777-7777-4777-8777-777777777777'::uuid,
  true,
  '2099-01-01T00:00:00Z'::timestamptz,
  '2026-01-01T00:00:00Z'::timestamptz
FROM unnest(ARRAY[
  'DEMO-BIN-BKK-01:TOKEN-0001',
  'DEMO-BIN-BKK-01:TOKEN-0002',
  'DEMO-BIN-BKK-01:TOKEN-0003',
  'DEMO-BIN-BKK-01:TOKEN-0004',
  'DEMO-BIN-BKK-01:TOKEN-0005',
  'DEMO-BIN-BKK-01:TOKEN-0006'
]) AS token_value
ON CONFLICT (token_hash) DO UPDATE SET
  expires_at = EXCLUDED.expires_at
WHERE qr_tokens.consumed_at IS NULL;

INSERT INTO routes (id, code, version, is_demo)
VALUES ('88888888-8888-4888-8888-888888888888', 'DEMO-BUS-01', 1, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO route_stops (id, route_id, sequence, location, geofence_m)
VALUES
  ('99999999-9999-4999-8999-999999999991', '88888888-8888-4888-8888-888888888888', 0, ST_SetSRID(ST_MakePoint(100.53500, 13.76490), 4326)::geography, 55),
  ('99999999-9999-4999-8999-999999999992', '88888888-8888-4888-8888-888888888888', 1, ST_SetSRID(ST_MakePoint(100.53870, 13.76490), 4326)::geography, 55),
  ('99999999-9999-4999-8999-999999999993', '88888888-8888-4888-8888-888888888888', 2, ST_SetSRID(ST_MakePoint(100.54240, 13.76490), 4326)::geography, 55)
ON CONFLICT (id) DO NOTHING;

INSERT INTO route_corridors (id, route_id, version, corridor, config_hash)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '88888888-8888-4888-8888-888888888888',
  1,
  ST_GeomFromText('POLYGON((100.5344 13.7642,100.5430 13.7642,100.5430 13.7656,100.5344 13.7656,100.5344 13.7642))', 4326),
  encode(digest('DEMO-BUS-01:v1:corridor-v1','sha256'),'hex')
)
ON CONFLICT (id) DO NOTHING;
