-- Keep the original manifest immutable while allowing a newer factor selection
-- to supersede it through an append-only revision record.
CREATE TABLE demo_factor_manifest_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity text NOT NULL CHECK (activity IN ('bus', 'recycling', 'tree')),
  factor_id uuid NOT NULL UNIQUE REFERENCES factor_catalog(id),
  expected_material text,
  supersedes_factor_id uuid NOT NULL REFERENCES factor_catalog(id),
  effective_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (factor_id <> supersedes_factor_id),
  CHECK (
    (activity = 'recycling' AND expected_material IS NOT NULL)
    OR (activity <> 'recycling' AND expected_material IS NULL)
  )
);
CREATE TRIGGER demo_factor_manifest_revisions_immutable
  BEFORE UPDATE OR DELETE ON demo_factor_manifest_revisions
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();

CREATE VIEW current_demo_factor_manifest AS
SELECT DISTINCT ON (activity) activity, factor_id, expected_material
FROM (
  SELECT activity, factor_id, expected_material,
         '-infinity'::timestamptz effective_at,
         '-infinity'::timestamptz created_at
  FROM demo_factor_manifest
  UNION ALL
  SELECT activity, factor_id, expected_material, effective_at, created_at
  FROM demo_factor_manifest_revisions
) versions
ORDER BY activity, effective_at DESC, created_at DESC, factor_id DESC;

CREATE OR REPLACE VIEW mock_demo_factor_readiness AS
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
           WHEN 'tree' THEN factor.value=9.500000000 AND (
             factor.assumptions->>'time_basis'='one_year'
             OR (
               factor.assumptions->>'projection_years' ~ '^[0-9]+([.][0-9]+)?$'
               AND factor.assumptions->>'survival_factor' ~ '^[0-9]+([.][0-9]+)?$'
             )
           )
           ELSE false
         END
       ), false) AS ready,
       factor.id AS factor_id
FROM required
LEFT JOIN current_demo_factor_manifest manifest ON manifest.activity=required.activity
LEFT JOIN factor_catalog factor ON factor.id=manifest.factor_id AND factor.activity::text=required.activity
LEFT JOIN mock_demo_factor_approvals approval ON approval.factor_id=factor.id;

CREATE OR REPLACE VIEW production_factor_readiness AS
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
LEFT JOIN current_demo_factor_manifest manifest ON manifest.activity=required.activity
LEFT JOIN factor_catalog factor ON factor.id=manifest.factor_id AND factor.activity::text=required.activity
LEFT JOIN users approver ON approver.id=factor.approved_by;

CREATE OR REPLACE FUNCTION validate_mock_demo_factor_approval() RETURNS trigger LANGUAGE plpgsql AS $$
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
  IF NOT EXISTS (SELECT 1 FROM current_demo_factor_manifest WHERE factor_id=NEW.factor_id) THEN
    RAISE EXCEPTION 'mock demo approval requires the current manifest factor';
  END IF;
  RETURN NEW;
END
$$;

-- Carbon accounting and presentation reward policy are separate contracts.
-- Bus/tree award the approved per-activity points; recycling scales by the
-- verified bottle count so 46 items award 20 points without fixing a total.
CREATE OR REPLACE FUNCTION apply_mock_demo_reward_policy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_activity text;
  target_scope text;
  target_input jsonb;
  target_points integer;
  current_points integer;
  calculated_points integer := NEW.points;
BEGIN
  IF NEW.claim_id IS NULL OR NEW.kind NOT IN ('credit', 'compensation') THEN
    RETURN NEW;
  END IF;

  SELECT activity, data_scope, impact_input
  INTO target_activity, target_scope, target_input
  FROM claims
  WHERE id = NEW.claim_id AND user_id = NEW.user_id;

  IF target_scope IS DISTINCT FROM 'mock_demo' THEN
    RETURN NEW;
  END IF;

  target_points := CASE target_activity
    WHEN 'tree' THEN 15
    WHEN 'bus' THEN 3
    WHEN 'recycling' THEN greatest(
      1,
      least(100, round(coalesce(nullif(target_input->>'approved_count','')::numeric, 0) * 20 / 46)::integer)
    )
    ELSE NULL
  END;
  IF target_points IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(sum(points), 0)::integer
  INTO current_points
  FROM point_ledger
  WHERE claim_id = NEW.claim_id;

  NEW.points := CASE
    WHEN NEW.kind = 'credit' THEN target_points
    ELSE target_points - current_points
  END;
  NEW.metadata := coalesce(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
    'reward_policy', 'mock_demo_activity_v2',
    'activity', target_activity,
    'awarded_points', target_points,
    'calculated_points_before_policy', calculated_points
  );

  IF NEW.points = 0 THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION ensure_mock_demo_fixed_reward_credit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_points integer;
BEGIN
  IF NEW.impact_status <> 'credited' OR OLD.impact_status = 'credited'
     OR NEW.data_scope <> 'mock_demo' THEN
    RETURN NEW;
  END IF;

  target_points := CASE NEW.activity
    WHEN 'tree' THEN 15
    WHEN 'bus' THEN 3
    WHEN 'recycling' THEN greatest(
      1,
      least(100, round(coalesce(nullif(NEW.impact_input->>'approved_count','')::numeric, 0) * 20 / 46)::integer)
    )
    ELSE NULL
  END;

  IF target_points IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM point_ledger
       WHERE claim_id = NEW.id AND kind = 'credit'
     ) THEN
    INSERT INTO point_ledger(user_id, claim_id, kind, points, metadata)
    VALUES (
      NEW.user_id,
      NEW.id,
      'credit',
      target_points,
      jsonb_build_object(
        'reward_policy', 'mock_demo_activity_v2',
        'activity', NEW.activity,
        'awarded_points', target_points,
        'calculated_points_before_policy', 0
      )
    );
  END IF;

  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION evaluate_blocked_claim_impact(target_claim_id uuid) RETURNS boolean LANGUAGE plpgsql AS $$
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
  LEFT JOIN current_demo_factor_manifest manifest ON manifest.factor_id = factor.id
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
    result := round_half_even(
      selected_factor.value
      * coalesce(nullif(selected_factor.assumptions->>'projection_years','')::numeric, 1)
      * coalesce(nullif(selected_factor.assumptions->>'survival_factor','')::numeric, 1),
      6
    );
    formula_text := 'verified tree count × annual factor × projection years × survival factor';
  ELSIF target_claim.activity = 'recycling' THEN
    impact := 'avoided';
    IF NOT (approved_input ? 'approved_count') THEN RETURN false; END IF;
    result := round_half_even((approved_input->>'approved_count')::numeric * selected_factor.value, 6);
    formula_text := 'verified PET count × derived mass/yield/net-substitution factor';
  ELSE
    impact := 'avoided';
    IF NOT (approved_input ? 'distance_km') OR NOT (selected_factor.assumptions ? 'car_factor') THEN RETURN false; END IF;
    result := round_half_even(greatest(0, (approved_input->>'distance_km')::numeric * ((selected_factor.assumptions->>'car_factor')::numeric - selected_factor.value)), 6);
    formula_text := 'distance_km × (car factor − scheduled-bus factor)';
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
