ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS building_function text,
  ADD COLUMN IF NOT EXISTS work_category text;

NOTIFY pgrst, 'reload schema';
