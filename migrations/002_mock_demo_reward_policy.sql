CREATE FUNCTION apply_mock_demo_reward_policy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_activity text;
  target_scope text;
  target_points integer;
  current_points integer;
  calculated_points integer := NEW.points;
BEGIN
  IF NEW.claim_id IS NULL OR NEW.kind NOT IN ('credit', 'compensation') THEN
    RETURN NEW;
  END IF;

  SELECT activity, data_scope
  INTO target_activity, target_scope
  FROM claims
  WHERE id = NEW.claim_id AND user_id = NEW.user_id;

  IF target_scope IS DISTINCT FROM 'mock_demo' THEN
    RETURN NEW;
  END IF;

  target_points := CASE target_activity
    WHEN 'tree' THEN 15
    WHEN 'bus' THEN 3
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
    'reward_policy', 'mock_demo_fixed_v1',
    'activity', target_activity,
    'fixed_points', target_points,
    'calculated_points_before_policy', calculated_points
  );

  IF NEW.points = 0 THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER point_mock_demo_reward_policy
  BEFORE INSERT ON point_ledger
  FOR EACH ROW EXECUTE FUNCTION apply_mock_demo_reward_policy();
