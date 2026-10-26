-- Allow a school to reuse a category name after the prior category is inactive.
-- Names must remain unique while the category is active.
drop index if exists public.unique_school_assessment_category_name;

create unique index unique_school_assessment_category_name
  on public.assessment_categories (school_id, name)
  where lower(btrim(status)) = 'active';
