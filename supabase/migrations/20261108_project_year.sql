ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS project_year INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_project_year_range_check'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
    ADD CONSTRAINT projects_project_year_range_check
    CHECK (project_year IS NULL OR project_year BETWEEN 2000 AND 2100);
  END IF;
END;
$$;

WITH matching_organizations AS (
  SELECT organization_id
  FROM public.projects
  GROUP BY organization_id
  HAVING COUNT(*) FILTER (WHERE lower(trim(name)) = 'as house - sukabumi') > 0
     AND COUNT(*) FILTER (WHERE lower(trim(name)) = 'charity house - bintaro') > 0
),
unique_target_organization AS (
  SELECT organization_id
  FROM matching_organizations
  WHERE (SELECT COUNT(*) FROM matching_organizations) = 1
)
UPDATE public.projects
SET project_year = 2027
WHERE organization_id = (SELECT organization_id FROM unique_target_organization)
  AND lower(trim(name)) IN ('as house - sukabumi', 'charity house - bintaro');
