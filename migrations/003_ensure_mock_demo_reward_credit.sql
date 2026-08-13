CREATE FUNCTION ensure_mock_demo_fixed_reward_credit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  fixed_points integer;
BEGIN
  IF NEW.impact_status <> 'credited' OR OLD.impact_status = 'credited'
     OR NEW.data_scope <> 'mock_demo' THEN
    RETURN NEW;
  END IF;

  fixed_points := CASE NEW.activity
    WHEN 'tree' THEN 15
    WHEN 'bus' THEN 3
    ELSE NULL
  END;

  IF fixed_points IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM point_ledger
       WHERE claim_id = NEW.id AND kind = 'credit'
     ) THEN
    INSERT INTO point_ledger(user_id, claim_id, kind, points, metadata)
    VALUES (
      NEW.user_id,
      NEW.id,
      'credit',
      fixed_points,
      jsonb_build_object(
        'reward_policy', 'mock_demo_fixed_v1',
        'activity', NEW.activity,
        'fixed_points', fixed_points,
        'calculated_points_before_policy', 0
      )
    );
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER claim_mock_demo_reward_credit
  AFTER UPDATE OF impact_status ON claims
  FOR EACH ROW EXECUTE FUNCTION ensure_mock_demo_fixed_reward_credit();
