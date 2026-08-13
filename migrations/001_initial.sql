CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE user_role AS ENUM ('user', 'reviewer', 'merchant', 'admin');
CREATE TYPE claim_state AS ENUM ('submitted', 'pending', 'pending_review', 'verified', 'rejected');
CREATE TYPE impact_status AS ENUM ('pending', 'credited', 'blocked_factor_approval');
CREATE TYPE impact_type AS ENUM ('avoided', 'projected_sequestration');
CREATE TYPE voucher_state AS ENUM ('issued', 'redeemed', 'expired', 'cancelled');
CREATE TYPE factor_status AS ENUM ('draft', 'approved', 'rejected');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  is_demo boolean NOT NULL DEFAULT false,
  data_scope text GENERATED ALWAYS AS (CASE WHEN is_demo THEN 'mock_demo' ELSE 'production' END) STORED,
  is_mock boolean GENERATED ALWAYS AS (is_demo) STORED,
  demo_only boolean GENERATED ALWAYS AS (is_demo) STORED,
  account_deletion_state text NOT NULL DEFAULT 'active'
    CHECK (account_deletion_state IN ('active', 'deleting', 'deleted')),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE deployment_metadata (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  data_scope text NOT NULL CHECK (data_scope IN ('mock_demo','production')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  leaderboard_opt_in boolean NOT NULL DEFAULT false,
  leaderboard_pseudonym text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT leaderboard_opt_in OR leaderboard_pseudonym IS NOT NULL)
);

CREATE TABLE idempotency_records (
  scope text NOT NULL,
  key text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  response_status integer,
  response_body jsonb,
  resource_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (scope, key)
);
CREATE INDEX idempotency_expiry_idx ON idempotency_records(expires_at);

CREATE TABLE claim_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'submitted', 'deleted')),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX claim_drafts_owner_state_idx ON claim_drafts(user_id, state) WHERE deleted_at IS NULL;

CREATE TABLE upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  claim_draft_id uuid NOT NULL REFERENCES claim_drafts(id),
  kind text NOT NULL CHECK (kind IN ('photo', 'gps_trace')),
  state text NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft', 'uploading', 'uploaded', 'finalized', 'failed', 'revoked', 'tombstoned')),
  upload_token_hash text UNIQUE CHECK (upload_token_hash IS NULL OR upload_token_hash ~ '^[a-f0-9]{64}$'),
  request_hash text,
  object_key text NOT NULL UNIQUE,
  content_type text CHECK (content_type IS NULL OR content_type IN ('image/jpeg', 'image/webp', 'application/json')),
  byte_size integer CHECK (byte_size IS NULL OR (byte_size > 0 AND byte_size <= 10485760)),
  expected_sha256 text CHECK (expected_sha256 IS NULL OR expected_sha256 ~ '^[a-f0-9]{64}$'),
  captured_at timestamptz,
  camera_make text,
  camera_model text,
  fixture_id text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  orphan_eligible_at timestamptz NOT NULL,
  uploaded_at timestamptz,
  evidence_id uuid UNIQUE,
  finalized_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  revoked_at timestamptz,
  tombstoned_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (
    state = 'tombstoned'
    OR (content_type IS NOT NULL AND byte_size IS NOT NULL AND expected_sha256 IS NOT NULL AND captured_at IS NOT NULL)
  ),
  CHECK (kind <> 'photo' OR state = 'tombstoned' OR (content_type IN ('image/jpeg', 'image/webp') AND camera_make IS NOT NULL AND camera_model IS NOT NULL)),
  CHECK (kind <> 'gps_trace' OR state = 'tombstoned' OR (content_type = 'application/json' AND camera_make IS NULL AND camera_model IS NULL))
  ,
  CHECK (fixture_id IS NULL OR state = 'tombstoned' OR fixture_id <> '')
);
CREATE INDEX upload_sessions_owner_state_idx ON upload_sessions(user_id, state);
CREATE INDEX upload_sessions_orphan_idx ON upload_sessions(orphan_eligible_at)
  WHERE state IN ('draft', 'failed', 'revoked', 'uploaded');

CREATE TABLE evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  data_scope text NOT NULL DEFAULT 'production' CHECK (data_scope IN ('mock_demo','production')),
  is_mock boolean NOT NULL DEFAULT false,
  is_synthetic boolean NOT NULL DEFAULT false,
  demo_only boolean NOT NULL DEFAULT false,
  fixture_id text,
  upload_session_id uuid NOT NULL UNIQUE REFERENCES upload_sessions(id),
  claim_draft_id uuid NOT NULL REFERENCES claim_drafts(id),
  kind text NOT NULL CHECK (kind IN ('photo', 'gps_trace')),
  object_key text NOT NULL UNIQUE,
  content_type text,
  sha256 text CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
  captured_at timestamptz,
  location geography(Point, 4326),
  expires_at timestamptz,
  tombstoned_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (deleted_at IS NOT NULL OR (content_type IS NOT NULL AND sha256 IS NOT NULL AND captured_at IS NOT NULL))
  ,
  CHECK (
    (data_scope='mock_demo' AND is_mock AND demo_only)
    OR (data_scope='production' AND NOT is_mock AND NOT demo_only AND NOT is_synthetic AND fixture_id IS NULL)
  ),
  CHECK (NOT is_synthetic OR (data_scope='mock_demo' AND fixture_id IS NOT NULL))
);
ALTER TABLE upload_sessions
  ADD CONSTRAINT upload_session_evidence_fk FOREIGN KEY (evidence_id) REFERENCES evidence(id);

CREATE TABLE evidence_fingerprints (
  evidence_id uuid NOT NULL REFERENCES evidence(id),
  fingerprint_type text NOT NULL DEFAULT 'hmac-sha256',
  key_id text NOT NULL,
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(evidence_id,key_id)
);

CREATE TABLE evidence_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES evidence(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  purpose text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gps_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  stable_id text NOT NULL,
  captured_at timestamptz NOT NULL,
  location geography(Point, 4326) NOT NULL,
  accuracy_m numeric(7,2) NOT NULL CHECK (accuracy_m >= 0),
  UNIQUE (evidence_id, stable_id),
  UNIQUE (evidence_id, captured_at, stable_id)
);
CREATE INDEX gps_samples_location_idx ON gps_samples USING gist(location);

CREATE TABLE routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code, version)
);
CREATE TABLE route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id),
  sequence integer NOT NULL CHECK (sequence >= 0),
  location geography(Point, 4326) NOT NULL,
  geofence_m numeric(7,2) NOT NULL CHECK (geofence_m > 0),
  UNIQUE(route_id, sequence)
);
CREATE TABLE route_corridors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id),
  version integer NOT NULL CHECK (version > 0),
  corridor geometry(Polygon, 4326) NOT NULL,
  config_hash text NOT NULL DEFAULT encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'),
  UNIQUE(route_id, version)
);
CREATE INDEX route_corridors_geometry_idx ON route_corridors USING gist(corridor);

CREATE TABLE claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  data_scope text NOT NULL DEFAULT 'production' CHECK (data_scope IN ('mock_demo','production')),
  is_mock boolean NOT NULL DEFAULT false,
  is_synthetic boolean NOT NULL DEFAULT false,
  demo_only boolean NOT NULL DEFAULT false,
  fixture_id text,
  activity text NOT NULL CHECK (activity IN ('bus', 'recycling', 'tree')),
  state claim_state NOT NULL DEFAULT 'submitted',
  impact_status impact_status NOT NULL DEFAULT 'pending',
  idempotency_scope text NOT NULL,
  idempotency_key text NOT NULL,
  request_digest text NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  impact_input jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason_code text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK (
    (state IN ('submitted', 'pending', 'pending_review') AND decided_at IS NULL)
    OR (state IN ('verified', 'rejected') AND decided_at IS NOT NULL)
  ),
  CHECK (
    (data_scope='mock_demo' AND is_mock AND demo_only)
    OR (data_scope='production' AND NOT is_mock AND NOT demo_only AND NOT is_synthetic AND fixture_id IS NULL)
  ),
  CHECK (NOT is_synthetic OR (data_scope='mock_demo' AND fixture_id IS NOT NULL)),
  UNIQUE(user_id, idempotency_scope, idempotency_key)
);
CREATE INDEX claims_user_state_idx ON claims(user_id, state);
CREATE INDEX claims_blocked_impact_idx ON claims(activity, submitted_at)
  WHERE state = 'verified' AND impact_status = 'blocked_factor_approval';

CREATE FUNCTION derive_owned_record_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_is_demo boolean;
BEGIN
  SELECT is_demo INTO owner_is_demo FROM users WHERE id=NEW.user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'owned record requires an existing user'; END IF;
  NEW.data_scope := CASE WHEN owner_is_demo THEN 'mock_demo' ELSE 'production' END;
  NEW.is_mock := owner_is_demo;
  NEW.demo_only := owner_is_demo;
  NEW.is_synthetic := owner_is_demo;
  NEW.fixture_id := CASE WHEN owner_is_demo THEN coalesce(NEW.fixture_id,'FIXTURE-BKK-20260812-01') ELSE NULL END;
  RETURN NEW;
END
$$;
CREATE TRIGGER evidence_scope_derived BEFORE INSERT ON evidence
  FOR EACH ROW EXECUTE FUNCTION derive_owned_record_scope();
CREATE TRIGGER claim_scope_derived BEFORE INSERT ON claims
  FOR EACH ROW EXECUTE FUNCTION derive_owned_record_scope();

CREATE TABLE claim_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id),
  from_state claim_state,
  to_state claim_state NOT NULL,
  actor_id uuid REFERENCES users(id),
  reason_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE claim_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id),
  reviewer_id uuid NOT NULL REFERENCES users(id),
  decision claim_state NOT NULL CHECK (decision IN ('verified', 'rejected')),
  reason_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE claim_evidence (
  claim_id uuid NOT NULL REFERENCES claims(id),
  evidence_id uuid NOT NULL REFERENCES evidence(id),
  role text NOT NULL DEFAULT 'proof',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (claim_id, evidence_id),
  UNIQUE(evidence_id)
);

CREATE TABLE bus_claim_metrics (
  claim_id uuid PRIMARY KEY REFERENCES claims(id),
  route_id uuid REFERENCES routes(id),
  route_version integer,
  config_hash text,
  boarded_at timestamptz NOT NULL,
  alighted_at timestamptz NOT NULL,
  gps_coverage numeric(7,4) NOT NULL CHECK (gps_coverage BETWEEN 0 AND 100),
  speed_window_pass numeric(7,4) NOT NULL CHECK (speed_window_pass BETWEEN 0 AND 100),
  stop_pair_pass numeric(7,4) NOT NULL CHECK (stop_pair_pass BETWEEN 0 AND 100),
  corridor_pass numeric(7,4) NOT NULL CHECK (corridor_pass BETWEEN 0 AND 100),
  distance_km numeric(18,6) NOT NULL DEFAULT 0 CHECK (distance_km >= 0),
  CHECK (boarded_at <= alighted_at)
);

CREATE TABLE fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL UNIQUE REFERENCES claims(id),
  user_id uuid NOT NULL REFERENCES users(id),
  type text NOT NULL CHECK (type IN ('trip', 'tree')),
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  version text NOT NULL DEFAULT 'v1',
  key_id text NOT NULL,
  config_hash text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(type, user_id, digest)
);

CREATE TABLE qr_bins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  location geography(Point, 4326) NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (id, is_demo)
);
CREATE TABLE qr_tokens (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  bin_id uuid NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  consumed_claim_id uuid UNIQUE REFERENCES claims(id),
  FOREIGN KEY (bin_id, is_demo) REFERENCES qr_bins(id, is_demo)
);
CREATE TABLE qr_token_redemptions (
  token_hash text PRIMARY KEY REFERENCES qr_tokens(token_hash),
  bin_id uuid NOT NULL REFERENCES qr_bins(id),
  claim_id uuid NOT NULL UNIQUE REFERENCES claims(id),
  consumed_at timestamptz NOT NULL
);
CREATE TABLE recycling_declarations (
  claim_id uuid PRIMARY KEY REFERENCES claims(id),
  user_id uuid NOT NULL REFERENCES users(id),
  bin_id uuid NOT NULL REFERENCES qr_bins(id),
  material text NOT NULL CHECK (material IN ('plastic', 'paper', 'glass', 'metal', 'electronics')),
  declared_count integer NOT NULL CHECK (declared_count > 0),
  approved_count integer CHECK (approved_count >= 0 AND approved_count <= declared_count),
  submitted_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::date,
  UNIQUE(user_id, bin_id, submitted_on)
);
CREATE TABLE tree_ai_results (
  claim_id uuid PRIMARY KEY REFERENCES claims(id),
  model_version text NOT NULL,
  visual_hash text,
  visual_similarity numeric(7,4) NOT NULL CHECK (visual_similarity BETWEEN 0 AND 100),
  nearest_distance_m numeric(10,4) CHECK (nearest_distance_m >= 0),
  outcome text NOT NULL CHECK (outcome IN ('pass', 'manual_review', 'duplicate', 'reject')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tree_claim_signals (
  claim_id uuid PRIMARY KEY REFERENCES claims(id),
  visual_hashes text[] NOT NULL CHECK (cardinality(visual_hashes) > 0),
  key_ids text[] NOT NULL CHECK (cardinality(key_ids) = cardinality(visual_hashes)),
  location_hashes text[] NOT NULL CHECK (cardinality(location_hashes) > 0),
  location_key_ids text[] NOT NULL CHECK (cardinality(location_key_ids) = cardinality(location_hashes)),
  captured_at timestamptz NOT NULL
);

CREATE TABLE factor_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity text NOT NULL CHECK (activity IN ('bus', 'recycling', 'tree')),
  code text NOT NULL,
  version text NOT NULL,
  value numeric(20,9) NOT NULL CHECK (value >= 0),
  unit text NOT NULL,
  source_url text NOT NULL,
  methodology_code text NOT NULL,
  effective_at timestamptz NOT NULL,
  assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  disclaimer_th text NOT NULL,
  proxy_copy_th text NOT NULL,
  copy_digest text GENERATED ALWAYS AS (
    encode(digest(disclaimer_th || E'\n' || proxy_copy_th, 'sha256'), 'hex')
  ) STORED,
  review_digest text GENERATED ALWAYS AS (
    encode(digest(
      id::text || E'\n' || activity || E'\n' || code || E'\n' || version || E'\n'
      || value::text || E'\n' || unit || E'\n' || source_url || E'\n' || methodology_code || E'\n'
      || encode(timestamptz_send(effective_at), 'hex') || E'\n' || assumptions::text || E'\n'
      || disclaimer_th || E'\n' || proxy_copy_th || E'\n' || is_synthetic::text,
      'sha256'
    ), 'hex')
  ) STORED,
  status factor_status NOT NULL DEFAULT 'draft',
  approved_by uuid REFERENCES users(id),
  approved_role user_role,
  approved_at timestamptz,
  rejected_by uuid REFERENCES users(id),
  rejected_at timestamptz,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'draft' AND approved_by IS NULL AND approved_role IS NULL AND approved_at IS NULL AND rejected_by IS NULL AND rejected_at IS NULL)
    OR (status = 'approved' AND approved_by IS NOT NULL AND approved_role = 'admin' AND approved_at IS NOT NULL AND rejected_by IS NULL AND rejected_at IS NULL AND is_synthetic = false)
    OR (status = 'rejected' AND rejected_by IS NOT NULL AND rejected_at IS NOT NULL AND approved_by IS NULL AND approved_role IS NULL AND approved_at IS NULL)
  ),
  UNIQUE(activity, code, version)
);
CREATE INDEX factor_catalog_selection_idx ON factor_catalog(activity, effective_at DESC)
  WHERE status = 'approved' AND is_synthetic = false;

CREATE TABLE mock_demo_factor_approvals (
  factor_id uuid PRIMARY KEY REFERENCES factor_catalog(id),
  approval_scope text NOT NULL DEFAULT 'mock_demo' CHECK (approval_scope='mock_demo'),
  approved_by uuid NOT NULL REFERENCES users(id),
  approved_role user_role NOT NULL CHECK (approved_role='admin'),
  approved_at timestamptz NOT NULL DEFAULT now(),
  is_mock boolean NOT NULL DEFAULT true CHECK (is_mock),
  demo_only boolean NOT NULL DEFAULT true CHECK (demo_only),
  reviewed_digest text NOT NULL CHECK (reviewed_digest ~ '^[a-f0-9]{64}$'),
  UNIQUE(factor_id, reviewed_digest)
);

CREATE TABLE demo_factor_manifest (
  activity text PRIMARY KEY CHECK (activity IN ('bus', 'recycling', 'tree')),
  factor_id uuid NOT NULL UNIQUE REFERENCES factor_catalog(id),
  expected_material text,
  CHECK (
    (activity = 'recycling' AND expected_material IS NOT NULL)
    OR (activity <> 'recycling' AND expected_material IS NULL)
  )
);

CREATE VIEW mock_demo_factor_readiness AS
WITH required(activity) AS (
  VALUES ('bus'::text), ('recycling'::text), ('tree'::text)
)
SELECT required.activity,
       COALESCE((
         manifest.activity=required.activity
         AND factor.activity::text=required.activity
         AND factor.status='draft'
         AND factor.is_synthetic=false
         AND factor.effective_at<=now()
         AND factor.code !~* '^(test|synthetic|fixture)([-_]|$)'
         AND approval.approval_scope='mock_demo'
         AND approval.is_mock=true
         AND approval.demo_only=true
         AND approval.reviewed_digest=factor.review_digest
         AND CASE manifest.activity
           WHEN 'bus' THEN factor.assumptions->>'car_factor' ~ '^[0-9]+([.][0-9]+)?$'
           WHEN 'recycling' THEN factor.assumptions->>'material'=manifest.expected_material
           WHEN 'tree' THEN factor.value=9.500000000 AND factor.assumptions->>'time_basis'='one_year'
           ELSE false
         END
       ), false) AS ready,
       factor.id AS factor_id
FROM required
LEFT JOIN demo_factor_manifest manifest ON manifest.activity=required.activity
LEFT JOIN factor_catalog factor ON factor.id=manifest.factor_id AND factor.activity::text=required.activity
LEFT JOIN mock_demo_factor_approvals approval ON approval.factor_id=factor.id;

CREATE VIEW production_factor_readiness AS
WITH required(activity) AS (
  VALUES ('bus'::text), ('recycling'::text), ('tree'::text)
)
SELECT required.activity,
       COALESCE((
         manifest.activity=required.activity
         AND factor.activity::text=required.activity
         AND factor.status='approved'
         AND factor.is_synthetic=false
         AND factor.effective_at<=now()
         AND factor.approved_role='admin'
         AND approver.is_demo=false
         AND NOT EXISTS (SELECT 1 FROM mock_demo_factor_approvals mock WHERE mock.factor_id=factor.id)
       ), false) AS ready,
       factor.id AS factor_id
FROM required
LEFT JOIN demo_factor_manifest manifest ON manifest.activity=required.activity
LEFT JOIN factor_catalog factor ON factor.id=manifest.factor_id AND factor.activity::text=required.activity
LEFT JOIN users approver ON approver.id=factor.approved_by;

CREATE TABLE calculation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id),
  factor_id uuid NOT NULL REFERENCES factor_catalog(id),
  entry_kind text NOT NULL DEFAULT 'original' CHECK (entry_kind IN ('original', 'correction')),
  correction_of uuid REFERENCES calculation_snapshots(id),
  impact_type impact_type NOT NULL,
  input jsonb NOT NULL,
  formula text NOT NULL,
  formula_version text NOT NULL DEFAULT 'v1',
  result_kg_co2e numeric(20,6) NOT NULL,
  unit text NOT NULL DEFAULT 'kgCO2e',
  factor_snapshot jsonb NOT NULL,
  disclaimer_th text NOT NULL,
  approval_scope text NOT NULL DEFAULT 'production' CHECK (approval_scope IN ('production','mock_demo')),
  is_mock boolean NOT NULL DEFAULT false,
  demo_only boolean NOT NULL DEFAULT false,
  reviewed_digest text,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(factor_id, reviewed_digest)
    REFERENCES mock_demo_factor_approvals(factor_id, reviewed_digest)
    DEFERRABLE INITIALLY DEFERRED,
  CHECK (
    (entry_kind='original' AND correction_of IS NULL AND result_kg_co2e >= 0)
    OR (entry_kind='correction' AND correction_of IS NOT NULL)
  ),
  CHECK (
    (approval_scope='mock_demo' AND is_mock AND demo_only AND reviewed_digest IS NOT NULL)
    OR (approval_scope='production' AND NOT is_mock AND NOT demo_only AND reviewed_digest IS NULL)
  )
);
CREATE UNIQUE INDEX calculation_original_claim_idx ON calculation_snapshots(claim_id) WHERE entry_kind='original';
CREATE TABLE carbon_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id),
  calculation_id uuid NOT NULL UNIQUE REFERENCES calculation_snapshots(id),
  entry_kind text NOT NULL DEFAULT 'original' CHECK (entry_kind IN ('original', 'correction')),
  correction_of uuid REFERENCES carbon_ledger(id),
  impact_type impact_type NOT NULL,
  kg_co2e numeric(18,6) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (entry_kind='original' AND correction_of IS NULL AND kg_co2e >= 0)
    OR (entry_kind='correction' AND correction_of IS NOT NULL)
  )
);
CREATE UNIQUE INDEX carbon_original_claim_idx ON carbon_ledger(claim_id) WHERE entry_kind='original';
CREATE INDEX carbon_ledger_impact_idx ON carbon_ledger(impact_type, created_at);

CREATE TABLE point_balances (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE point_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  claim_id uuid REFERENCES claims(id),
  voucher_id uuid,
  kind text NOT NULL CHECK (kind IN ('credit', 'debit', 'refund', 'compensation')),
  points integer NOT NULL CHECK (points <> 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind IN ('credit', 'refund') AND points > 0)
    OR (kind = 'debit' AND points < 0)
    OR kind = 'compensation'
  ),
  UNIQUE(voucher_id, kind)
);
CREATE UNIQUE INDEX point_claim_credit_idx ON point_ledger(claim_id) WHERE kind='credit';

CREATE TABLE merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES users(id),
  name text NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id),
  title_th text NOT NULL,
  description_th text NOT NULL DEFAULT 'รางวัลสาธิต ไม่มีการชำระเงินจริง',
  point_cost integer NOT NULL CHECK (point_cost > 0),
  inventory integer NOT NULL DEFAULT 100 CHECK (inventory >= 0),
  active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false
);
CREATE TABLE vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  reward_id uuid NOT NULL REFERENCES rewards(id),
  point_cost integer NOT NULL CHECK (point_cost > 0),
  token_hash text NOT NULL UNIQUE,
  display_code text NOT NULL UNIQUE,
  state voucher_state NOT NULL DEFAULT 'issued',
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  cancelled_at timestamptz,
  CHECK (expires_at = issued_at + interval '7 days'),
  CHECK (
    (state = 'issued' AND redeemed_at IS NULL AND cancelled_at IS NULL)
    OR (state = 'redeemed' AND redeemed_at IS NOT NULL AND cancelled_at IS NULL)
    OR (state = 'cancelled' AND cancelled_at IS NOT NULL AND redeemed_at IS NULL)
    OR (state = 'expired' AND redeemed_at IS NULL AND cancelled_at IS NULL)
  )
);
ALTER TABLE point_ledger
  ADD CONSTRAINT point_ledger_voucher_fk FOREIGN KEY (voucher_id) REFERENCES vouchers(id);
CREATE TABLE redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL UNIQUE REFERENCES vouchers(id),
  merchant_id uuid NOT NULL REFERENCES merchants(id),
  idempotency_key text NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, idempotency_key)
);

CREATE TABLE weekly_leaderboard (
  week_start date NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  is_demo boolean NOT NULL,
  pseudonym text NOT NULL,
  points integer NOT NULL CHECK (points >= 0),
  PRIMARY KEY(week_start, user_id)
);
CREATE TABLE community_projections (
  week_start date NOT NULL,
  is_demo boolean NOT NULL,
  avoided_kg_co2e numeric(18,6) NOT NULL DEFAULT 0 CHECK (avoided_kg_co2e >= 0),
  projected_sequestration_kg_co2e numeric(18,6) NOT NULL DEFAULT 0 CHECK (projected_sequestration_kg_co2e >= 0),
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  PRIMARY KEY(week_start, is_demo)
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id),
  event_type text NOT NULL,
  subject_type text NOT NULL,
  subject_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION reject_immutable_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; use a compensating insert', TG_TABLE_NAME;
END
$$;
CREATE FUNCTION reject_user_scope_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
    RAISE EXCEPTION 'user data scope is immutable';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER user_data_scope_immutable BEFORE UPDATE OF is_demo ON users
  FOR EACH ROW EXECUTE FUNCTION reject_user_scope_change();
CREATE TRIGGER evidence_scope_immutable BEFORE UPDATE OF user_id,data_scope,is_mock,is_synthetic,demo_only,fixture_id ON evidence
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER claim_scope_immutable BEFORE UPDATE OF user_id,data_scope,is_mock,is_synthetic,demo_only,fixture_id ON claims
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER calculation_snapshots_immutable BEFORE UPDATE OR DELETE ON calculation_snapshots FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER carbon_ledger_immutable BEFORE UPDATE OR DELETE ON carbon_ledger FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER point_ledger_immutable BEFORE UPDATE OR DELETE ON point_ledger FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER claim_evidence_immutable BEFORE UPDATE OR DELETE ON claim_evidence FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER evidence_fingerprints_immutable BEFORE UPDATE OR DELETE ON evidence_fingerprints FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER routes_immutable BEFORE UPDATE OR DELETE ON routes FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER route_stops_immutable BEFORE UPDATE OR DELETE ON route_stops FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER route_corridors_immutable BEFORE UPDATE OR DELETE ON route_corridors FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER demo_factor_manifest_immutable BEFORE UPDATE OR DELETE ON demo_factor_manifest FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();

CREATE FUNCTION apply_point_ledger_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE new_balance integer;
BEGIN
  IF NEW.points < 0 THEN
    UPDATE point_balances
    SET balance = balance + NEW.points, updated_at = now()
    WHERE user_id = NEW.user_id AND balance + NEW.points >= 0
    RETURNING balance INTO new_balance;
  ELSE
    INSERT INTO point_balances(user_id, balance)
    VALUES (NEW.user_id, NEW.points)
    ON CONFLICT(user_id) DO UPDATE
      SET balance = point_balances.balance + EXCLUDED.balance, updated_at = now()
    RETURNING balance INTO new_balance;
  END IF;
  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'point balance cannot be negative';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER point_ledger_balance AFTER INSERT ON point_ledger FOR EACH ROW EXECUTE FUNCTION apply_point_ledger_entry();

CREATE FUNCTION round_half_even(value numeric, scale integer) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  multiplier numeric := power(10::numeric, scale);
  shifted numeric := abs(value) * multiplier;
  base numeric := floor(shifted);
  fraction numeric := shifted - base;
  rounded numeric;
BEGIN
  IF fraction < 0.5 THEN
    rounded := base;
  ELSIF fraction > 0.5 THEN
    rounded := base + 1;
  ELSE
    rounded := CASE WHEN mod(base, 2) = 0 THEN base ELSE base + 1 END;
  END IF;
  RETURN CASE WHEN value < 0 THEN -rounded ELSE rounded END / multiplier;
END
$$;

CREATE FUNCTION rebuild_point_balance(target_user_id uuid) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE rebuilt integer;
BEGIN
  SELECT coalesce(sum(points), 0)::integer INTO rebuilt
  FROM point_ledger WHERE user_id = target_user_id;
  IF rebuilt < 0 THEN
    RAISE EXCEPTION 'point ledger cannot rebuild to a negative balance';
  END IF;
  INSERT INTO point_balances(user_id, balance)
  VALUES (target_user_id, rebuilt)
  ON CONFLICT(user_id) DO UPDATE
    SET balance = EXCLUDED.balance, updated_at = now();
  RETURN rebuilt;
END
$$;

CREATE FUNCTION validate_factor_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE approver_role user_role; approver_is_demo boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM mock_demo_factor_approvals WHERE factor_id=OLD.id)
     AND (
       NEW.activity IS DISTINCT FROM OLD.activity OR NEW.code IS DISTINCT FROM OLD.code
       OR NEW.version IS DISTINCT FROM OLD.version OR NEW.value IS DISTINCT FROM OLD.value
       OR NEW.unit IS DISTINCT FROM OLD.unit OR NEW.source_url IS DISTINCT FROM OLD.source_url
       OR NEW.methodology_code IS DISTINCT FROM OLD.methodology_code
       OR NEW.effective_at IS DISTINCT FROM OLD.effective_at OR NEW.assumptions IS DISTINCT FROM OLD.assumptions
       OR NEW.disclaimer_th IS DISTINCT FROM OLD.disclaimer_th OR NEW.proxy_copy_th IS DISTINCT FROM OLD.proxy_copy_th
       OR NEW.is_synthetic IS DISTINCT FROM OLD.is_synthetic
       OR NEW.status IS DISTINCT FROM OLD.status
     ) THEN
    RAISE EXCEPTION 'mock-reviewed factor identity and status are immutable';
  END IF;
  IF OLD.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'terminal factor versions are immutable';
  END IF;
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    SELECT role,is_demo INTO approver_role,approver_is_demo FROM users WHERE id = NEW.approved_by AND deleted_at IS NULL;
    IF approver_role IS DISTINCT FROM 'admin'::user_role
       OR approver_is_demo IS DISTINCT FROM false
       OR NEW.approved_role IS DISTINCT FROM approver_role THEN
      RAISE EXCEPTION 'production factor approval requires an active non-demo admin acting as project owner/domain reviewer';
    END IF;
    IF NEW.is_synthetic OR NEW.code ~* '^(test|synthetic|fixture)([-_]|$)'
       OR NEW.value < 0 OR btrim(NEW.unit) = '' OR btrim(NEW.source_url) = ''
       OR btrim(NEW.methodology_code) = '' OR btrim(NEW.disclaimer_th) = '' OR btrim(NEW.proxy_copy_th) = '' THEN
      RAISE EXCEPTION 'factor approval provenance and Thai copy are incomplete';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER factor_approval_guard BEFORE UPDATE ON factor_catalog FOR EACH ROW EXECUTE FUNCTION validate_factor_approval();
CREATE TRIGGER factor_catalog_no_delete BEFORE DELETE ON factor_catalog FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();

CREATE FUNCTION validate_mock_demo_factor_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE selected factor_catalog%ROWTYPE; approver users%ROWTYPE;
BEGIN
  SELECT * INTO selected FROM factor_catalog WHERE id=NEW.factor_id FOR SHARE;
  SELECT * INTO approver FROM users WHERE id=NEW.approved_by AND deleted_at IS NULL;
  IF selected.id IS NULL OR approver.id IS NULL
     OR selected.status <> 'draft'
     OR selected.is_synthetic
     OR selected.code ~* '^(test|synthetic|fixture)([-_]|$)'
     OR approver.role <> 'admin'::user_role
     OR approver.is_demo <> true
     OR NEW.approved_role <> 'admin'::user_role
     OR NEW.approval_scope <> 'mock_demo'
     OR NEW.is_mock <> true
     OR NEW.demo_only <> true
     OR NEW.reviewed_digest <> selected.review_digest THEN
    RAISE EXCEPTION 'mock demo approval requires a draft non-synthetic manifest factor reviewed by an active demo admin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM demo_factor_manifest WHERE factor_id=NEW.factor_id) THEN
    RAISE EXCEPTION 'mock demo approval requires a manifest factor';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER mock_demo_factor_approval_guard BEFORE INSERT OR UPDATE ON mock_demo_factor_approvals
  FOR EACH ROW EXECUTE FUNCTION validate_mock_demo_factor_approval();
CREATE TRIGGER mock_demo_factor_approval_immutable BEFORE UPDATE OR DELETE ON mock_demo_factor_approvals
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();

CREATE FUNCTION validate_calculation_factor() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE selected factor_catalog%ROWTYPE; target_claim claims%ROWTYPE; mock mock_demo_factor_approvals%ROWTYPE;
BEGIN
  IF NEW.entry_kind='correction' THEN
    IF NOT EXISTS(
      SELECT 1 FROM calculation_snapshots original
      WHERE original.id=NEW.correction_of AND original.claim_id=NEW.claim_id
        AND original.factor_id=NEW.factor_id AND original.impact_type=NEW.impact_type
        AND original.entry_kind='original'
        AND original.approval_scope=NEW.approval_scope
        AND original.is_mock=NEW.is_mock AND original.demo_only=NEW.demo_only
        AND original.reviewed_digest IS NOT DISTINCT FROM NEW.reviewed_digest
    ) THEN RAISE EXCEPTION 'calculation correction must reference the matching original'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO target_claim FROM claims WHERE id=NEW.claim_id;
  SELECT * INTO selected FROM factor_catalog WHERE id=NEW.factor_id;
  IF NOT FOUND OR selected.is_synthetic THEN RAISE EXCEPTION 'calculation requires a non-synthetic factor'; END IF;
  IF target_claim.data_scope='mock_demo' THEN
    SELECT * INTO mock FROM mock_demo_factor_approvals WHERE factor_id=selected.id;
    IF selected.status <> 'draft' OR NOT FOUND
       OR mock.reviewed_digest <> selected.review_digest
       OR NEW.approval_scope <> 'mock_demo' OR NEW.is_mock <> true OR NEW.demo_only <> true
       OR NEW.reviewed_digest <> mock.reviewed_digest THEN
      RAISE EXCEPTION 'demo calculation requires matching scoped mock approval';
    END IF;
    IF NEW.factor_snapshot->>'approved_by' IS DISTINCT FROM mock.approved_by::text
       OR NEW.factor_snapshot->>'approved_role' IS DISTINCT FROM mock.approved_role::text
       OR (NEW.factor_snapshot->>'approved_at')::timestamptz IS DISTINCT FROM mock.approved_at THEN
      RAISE EXCEPTION 'demo calculation approval snapshot does not match its mock approval';
    END IF;
  ELSIF selected.status <> 'approved'
     OR NEW.approval_scope <> 'production' OR NEW.is_mock <> false OR NEW.demo_only <> false
     OR NEW.reviewed_digest IS NOT NULL
     OR EXISTS (SELECT 1 FROM mock_demo_factor_approvals WHERE factor_id=selected.id) THEN
    RAISE EXCEPTION 'production calculation requires a production-approved factor';
  ELSIF NEW.factor_snapshot->>'approved_by' IS DISTINCT FROM selected.approved_by::text
     OR NEW.factor_snapshot->>'approved_role' IS DISTINCT FROM selected.approved_role::text
     OR (NEW.factor_snapshot->>'approved_at')::timestamptz IS DISTINCT FROM selected.approved_at THEN
    RAISE EXCEPTION 'production calculation approval snapshot does not match its catalog approval';
  END IF;
  IF NEW.factor_snapshot->>'id' IS DISTINCT FROM selected.id::text
     OR NEW.factor_snapshot->>'activity' IS DISTINCT FROM selected.activity
     OR NEW.factor_snapshot->>'code' IS DISTINCT FROM selected.code
     OR NEW.factor_snapshot->>'value' IS DISTINCT FROM selected.value::text
     OR NEW.factor_snapshot->>'unit' IS DISTINCT FROM selected.unit
     OR NEW.factor_snapshot->>'version' IS DISTINCT FROM selected.version
     OR NEW.factor_snapshot->>'source_url' IS DISTINCT FROM selected.source_url
     OR NEW.factor_snapshot->>'methodology_code' IS DISTINCT FROM selected.methodology_code
     OR (NEW.factor_snapshot->>'effective_at')::timestamptz IS DISTINCT FROM selected.effective_at
     OR NEW.factor_snapshot->'assumptions' IS DISTINCT FROM selected.assumptions
     OR NEW.factor_snapshot->>'disclaimer_th' IS DISTINCT FROM selected.disclaimer_th
     OR NEW.factor_snapshot->>'proxy_copy_th' IS DISTINCT FROM selected.proxy_copy_th
     OR NEW.factor_snapshot->>'copy_digest' IS DISTINCT FROM selected.copy_digest
     OR NEW.factor_snapshot->>'review_digest' IS DISTINCT FROM selected.review_digest
     OR coalesce((NEW.factor_snapshot->>'is_synthetic')::boolean,false) IS DISTINCT FROM selected.is_synthetic
     OR NEW.factor_snapshot->>'status' IS DISTINCT FROM selected.status::text THEN
    RAISE EXCEPTION 'calculation factor snapshot does not match the approved catalog version';
  END IF;
  IF NEW.factor_snapshot->>'approval_scope' IS DISTINCT FROM NEW.approval_scope
     OR coalesce((NEW.factor_snapshot->>'is_mock')::boolean,false) IS DISTINCT FROM NEW.is_mock
     OR coalesce((NEW.factor_snapshot->>'demo_only')::boolean,false) IS DISTINCT FROM NEW.demo_only
     OR NEW.factor_snapshot->>'reviewed_digest' IS DISTINCT FROM NEW.reviewed_digest THEN
    RAISE EXCEPTION 'calculation approval snapshot does not match its scope';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER calculation_factor_guard BEFORE INSERT ON calculation_snapshots FOR EACH ROW EXECUTE FUNCTION validate_calculation_factor();

CREATE FUNCTION validate_point_credit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind='credit' AND (
    NEW.claim_id IS NULL
    OR NOT EXISTS(
      SELECT 1 FROM claims claim
      JOIN calculation_snapshots calculation ON calculation.claim_id=claim.id
      WHERE claim.id=NEW.claim_id AND claim.user_id=NEW.user_id AND claim.state='verified'
    )
  ) THEN
    RAISE EXCEPTION 'point credit requires a verified claim and approved calculation';
  END IF;
  IF NEW.kind='compensation' AND (
    NEW.claim_id IS NULL
    OR NOT EXISTS(SELECT 1 FROM claims WHERE id=NEW.claim_id AND user_id=NEW.user_id AND state='verified')
    OR btrim(coalesce(NEW.metadata->>'reason',''))=''
  ) THEN
    RAISE EXCEPTION 'point compensation requires a verified owned claim and reason';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER point_credit_guard BEFORE INSERT ON point_ledger FOR EACH ROW EXECUTE FUNCTION validate_point_credit();

CREATE FUNCTION validate_carbon_correction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entry_kind='correction' AND (
    NOT EXISTS(
      SELECT 1 FROM carbon_ledger original
      WHERE original.id=NEW.correction_of AND original.claim_id=NEW.claim_id
        AND original.impact_type=NEW.impact_type AND original.entry_kind='original'
    )
    OR (SELECT coalesce(sum(kg_co2e),0) FROM carbon_ledger WHERE claim_id=NEW.claim_id) + NEW.kg_co2e < 0
  ) THEN
    RAISE EXCEPTION 'carbon correction must reference the matching original and keep the total nonnegative';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER carbon_correction_guard BEFORE INSERT ON carbon_ledger FOR EACH ROW EXECUTE FUNCTION validate_carbon_correction();

CREATE FUNCTION validate_claim_credit_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.impact_status='credited' AND OLD.impact_status <> 'credited' AND (
    NEW.state <> 'verified'
    OR NOT EXISTS(SELECT 1 FROM calculation_snapshots WHERE claim_id=NEW.id)
    OR NOT EXISTS(SELECT 1 FROM carbon_ledger WHERE claim_id=NEW.id)
  ) THEN
    RAISE EXCEPTION 'credited impact requires a verified claim and immutable ledgers';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER claim_credit_status_guard BEFORE UPDATE OF impact_status ON claims FOR EACH ROW EXECUTE FUNCTION validate_claim_credit_status();

CREATE FUNCTION sync_evidence_retention_from_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state IN ('verified', 'rejected') THEN
    UPDATE evidence e
    SET expires_at = NEW.decided_at + interval '30 days'
    FROM claim_evidence ce
    WHERE ce.claim_id = NEW.id AND ce.evidence_id = e.id AND e.deleted_at IS NULL;
  ELSE
    UPDATE evidence e
    SET expires_at = NULL
    FROM claim_evidence ce
    WHERE ce.claim_id = NEW.id AND ce.evidence_id = e.id AND e.deleted_at IS NULL;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER claim_retention_sync AFTER UPDATE OF state, decided_at ON claims FOR EACH ROW EXECUTE FUNCTION sync_evidence_retention_from_claim();

CREATE FUNCTION sync_bound_evidence_retention() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_state claim_state; target_decided_at timestamptz;
BEGIN
  SELECT state, decided_at INTO target_state, target_decided_at FROM claims WHERE id = NEW.claim_id;
  UPDATE evidence SET expires_at = CASE
    WHEN target_state IN ('verified', 'rejected') THEN target_decided_at + interval '30 days'
    ELSE NULL
  END WHERE id = NEW.evidence_id;
  RETURN NEW;
END
$$;
CREATE TRIGGER claim_evidence_retention_sync AFTER INSERT ON claim_evidence FOR EACH ROW EXECUTE FUNCTION sync_bound_evidence_retention();

CREATE FUNCTION purge_gps_on_evidence_tombstone() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM gps_samples WHERE evidence_id = NEW.id;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER evidence_gps_purge AFTER UPDATE OF deleted_at ON evidence FOR EACH ROW EXECUTE FUNCTION purge_gps_on_evidence_tombstone();

CREATE FUNCTION evaluate_blocked_claim_impact(target_claim_id uuid) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  target_claim claims%ROWTYPE;
  selected_factor factor_catalog%ROWTYPE;
  selected_mock mock_demo_factor_approvals%ROWTYPE;
  target_is_demo boolean;
  impact impact_type;
  result numeric(20,6);
  awarded_points integer;
  calculation_id uuid;
  approved_input jsonb;
  formula_text text;
BEGIN
  SELECT * INTO target_claim FROM claims
  WHERE id = target_claim_id FOR UPDATE;
  IF NOT FOUND OR target_claim.state <> 'verified' OR target_claim.impact_status <> 'blocked_factor_approval' THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM calculation_snapshots WHERE claim_id = target_claim_id) THEN
    UPDATE claims SET impact_status = 'credited' WHERE id = target_claim_id;
    RETURN false;
  END IF;
  target_is_demo := target_claim.data_scope='mock_demo';
  SELECT factor.* INTO selected_factor
  FROM factor_catalog factor
  LEFT JOIN demo_factor_manifest manifest ON manifest.factor_id = factor.id
  LEFT JOIN mock_demo_factor_approvals mock ON mock.factor_id=factor.id
  WHERE factor.activity = target_claim.activity
    AND factor.is_synthetic = false
    AND factor.effective_at <= now()
    AND (
      target_claim.activity <> 'recycling'
      OR factor.assumptions->>'material' = target_claim.impact_input->>'material'
    )
    AND (
      (target_is_demo = false AND factor.status='approved' AND mock.factor_id IS NULL)
      OR (
        target_is_demo = true AND factor.status='draft'
        AND manifest.activity = target_claim.activity
        AND (
          manifest.expected_material IS NULL
          OR manifest.expected_material = target_claim.impact_input->>'material'
        )
        AND mock.approval_scope='mock_demo' AND mock.is_mock AND mock.demo_only
        AND mock.reviewed_digest=factor.review_digest
      )
    )
  ORDER BY factor.effective_at DESC, factor.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  IF target_is_demo THEN
    SELECT * INTO selected_mock FROM mock_demo_factor_approvals WHERE factor_id=selected_factor.id;
  END IF;

  approved_input := target_claim.impact_input;
  IF target_claim.activity = 'tree' THEN
    impact := 'projected_sequestration';
    result := round_half_even(selected_factor.value, 6);
    formula_text := 'annual projected proxy factor × 1 tree';
  ELSIF target_claim.activity = 'recycling' THEN
    impact := 'avoided';
    IF NOT (approved_input ? 'approved_count') THEN RETURN false; END IF;
    result := round_half_even((approved_input->>'approved_count')::numeric * selected_factor.value, 6);
    formula_text := 'reviewed item count × factor';
  ELSE
    impact := 'avoided';
    IF NOT (approved_input ? 'distance_km') OR NOT (selected_factor.assumptions ? 'car_factor') THEN RETURN false; END IF;
    result := round_half_even(greatest(0, (approved_input->>'distance_km')::numeric * ((selected_factor.assumptions->>'car_factor')::numeric - selected_factor.value)), 6);
    formula_text := 'distance_km × (car factor − bus factor)';
  END IF;

  awarded_points := least(100, floor((result / 0.1) * CASE WHEN impact = 'projected_sequestration' THEN 0.25 ELSE 1 END)::integer);
  INSERT INTO calculation_snapshots(
    claim_id, factor_id, impact_type, input, formula, result_kg_co2e,
    factor_snapshot, disclaimer_th, approval_scope,is_mock,demo_only,reviewed_digest
  ) VALUES (
    target_claim.id, selected_factor.id, impact, approved_input, formula_text, result,
    jsonb_build_object(
      'id', selected_factor.id, 'activity', selected_factor.activity, 'code', selected_factor.code,
      'value', selected_factor.value::text, 'unit', selected_factor.unit,
      'version', selected_factor.version, 'source_url', selected_factor.source_url,
      'methodology_code', selected_factor.methodology_code, 'effective_at', selected_factor.effective_at,
      'assumptions', selected_factor.assumptions, 'disclaimer_th', selected_factor.disclaimer_th,
      'proxy_copy_th', selected_factor.proxy_copy_th, 'copy_digest', selected_factor.copy_digest,
      'review_digest', selected_factor.review_digest, 'is_synthetic', selected_factor.is_synthetic,
      'status', selected_factor.status,
      'approved_by', CASE WHEN target_is_demo THEN selected_mock.approved_by ELSE selected_factor.approved_by END,
      'approved_role', CASE WHEN target_is_demo THEN selected_mock.approved_role ELSE selected_factor.approved_role END,
      'approved_at', CASE WHEN target_is_demo THEN selected_mock.approved_at ELSE selected_factor.approved_at END,
      'approval_scope', CASE WHEN target_is_demo THEN 'mock_demo' ELSE 'production' END,
      'is_mock', target_is_demo, 'demo_only', target_is_demo,
      'reviewed_digest', CASE WHEN target_is_demo THEN selected_mock.reviewed_digest ELSE NULL END
    ),
    selected_factor.disclaimer_th,
    CASE WHEN target_is_demo THEN 'mock_demo' ELSE 'production' END,
    target_is_demo,target_is_demo,
    CASE WHEN target_is_demo THEN selected_mock.reviewed_digest ELSE NULL END
  ) RETURNING id INTO calculation_id;
  INSERT INTO carbon_ledger(claim_id, calculation_id, impact_type, kg_co2e)
  VALUES (target_claim.id, calculation_id, impact, result);
  IF awarded_points > 0 THEN
    INSERT INTO point_ledger(user_id, claim_id, kind, points)
    VALUES (target_claim.user_id, target_claim.id, 'credit', awarded_points);
  END IF;
  UPDATE claims SET impact_status = 'credited' WHERE id = target_claim.id;
  INSERT INTO audit_events(actor_id,event_type,subject_type,subject_id,metadata)
  VALUES (
    target_claim.user_id,'impact.credited','claim',target_claim.id,
    jsonb_build_object(
      'activity',target_claim.activity,'factor_id',selected_factor.id,
      'factor_version',selected_factor.version,'factor_review_digest',selected_factor.review_digest,
      'approval_scope',CASE WHEN target_is_demo THEN 'mock_demo' ELSE 'production' END,
      'data_scope',CASE WHEN target_is_demo THEN 'mock_demo' ELSE 'production' END,
      'is_mock',target_is_demo,'demo_only',target_is_demo,
      'actor_role','user','correlation_id',CASE WHEN target_is_demo THEN 'mock-demo:FIXTURE-BKK-20260812-01' ELSE 'impact.credited:' || target_claim.id::text END,
      'fixture_id',CASE WHEN target_is_demo THEN 'FIXTURE-BKK-20260812-01' ELSE NULL END,
      'outcome','credited','calculation_id',calculation_id,'points',awarded_points
    )
  );
  RETURN true;
END
$$;

CREATE FUNCTION rebuild_bangkok_weekly_projections(target_week date, target_is_demo boolean)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE week_start_utc timestamptz; week_end_utc timestamptz;
BEGIN
  week_start_utc := target_week::timestamp AT TIME ZONE 'Asia/Bangkok';
  week_end_utc := (target_week + 7)::timestamp AT TIME ZONE 'Asia/Bangkok';
  DELETE FROM weekly_leaderboard WHERE week_start = target_week AND is_demo = target_is_demo;
  WITH eligible_claims AS (
    SELECT claim.id, claim.user_id
    FROM claims claim
    JOIN users account ON account.id=claim.user_id
    WHERE claim.state='verified'
      AND account.is_demo=target_is_demo
      AND account.deleted_at IS NULL
      AND account.account_deletion_state='active'
      AND EXISTS (
        SELECT 1
        FROM calculation_snapshots calculation
        JOIN factor_catalog factor ON factor.id=calculation.factor_id
        WHERE calculation.claim_id=claim.id
          AND factor.is_synthetic=false
          AND (
            (target_is_demo AND calculation.approval_scope='mock_demo' AND calculation.is_mock AND calculation.demo_only AND calculation.reviewed_digest IS NOT NULL)
            OR
            (NOT target_is_demo AND calculation.approval_scope='production' AND NOT calculation.is_mock AND NOT calculation.demo_only AND factor.status='approved')
          )
      )
  ),
  point_totals AS (
    SELECT point.user_id, sum(point.points)::integer AS points
    FROM point_ledger point
    JOIN eligible_claims claim ON claim.id=point.claim_id
    WHERE point.kind IN ('credit','compensation')
      AND point.created_at >= week_start_utc AND point.created_at < week_end_utc
    GROUP BY point.user_id
  )
  INSERT INTO weekly_leaderboard(week_start, user_id, is_demo, pseudonym, points)
  SELECT target_week, point.user_id, target_is_demo, preference.leaderboard_pseudonym, point.points
  FROM point_totals point
  JOIN user_preferences preference
    ON preference.user_id=point.user_id AND preference.leaderboard_opt_in=true
  WHERE point.points > 0;

  WITH eligible_claims AS (
    SELECT claim.id
    FROM claims claim
    JOIN users account ON account.id=claim.user_id
    WHERE claim.state='verified'
      AND account.is_demo=target_is_demo
      AND account.deleted_at IS NULL
      AND account.account_deletion_state='active'
      AND EXISTS (
        SELECT 1
        FROM calculation_snapshots calculation
        JOIN factor_catalog factor ON factor.id=calculation.factor_id
        WHERE calculation.claim_id=claim.id
          AND factor.is_synthetic=false
          AND (
            (target_is_demo AND calculation.approval_scope='mock_demo' AND calculation.is_mock AND calculation.demo_only AND calculation.reviewed_digest IS NOT NULL)
            OR
            (NOT target_is_demo AND calculation.approval_scope='production' AND NOT calculation.is_mock AND NOT calculation.demo_only AND factor.status='approved')
          )
      )
  ),
  carbon_totals AS (
    SELECT
      coalesce(sum(carbon.kg_co2e) FILTER (WHERE carbon.impact_type='avoided'),0) AS avoided,
      coalesce(sum(carbon.kg_co2e) FILTER (WHERE carbon.impact_type='projected_sequestration'),0) AS projected
    FROM carbon_ledger carbon
    JOIN eligible_claims claim ON claim.id=carbon.claim_id
    WHERE carbon.created_at >= week_start_utc AND carbon.created_at < week_end_utc
  ),
  point_totals AS (
    SELECT coalesce(sum(point.points),0)::integer AS points
    FROM point_ledger point
    JOIN eligible_claims claim ON claim.id=point.claim_id
    WHERE point.kind IN ('credit','compensation')
      AND point.created_at >= week_start_utc AND point.created_at < week_end_utc
  )
  INSERT INTO community_projections(week_start, is_demo, avoided_kg_co2e, projected_sequestration_kg_co2e, points)
  SELECT target_week, target_is_demo,
    greatest(carbon.avoided,0),
    greatest(carbon.projected,0),
    greatest(point.points,0)
  FROM carbon_totals carbon
  CROSS JOIN point_totals point
  ON CONFLICT (week_start, is_demo) DO UPDATE SET
    avoided_kg_co2e = EXCLUDED.avoided_kg_co2e,
    projected_sequestration_kg_co2e = EXCLUDED.projected_sequestration_kg_co2e,
    points = EXCLUDED.points;
END
$$;
