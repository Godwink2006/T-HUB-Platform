alter table public.student_enrollments
  add column if not exists student_photo_snapshot text;

with transfer_identity as (
  select distinct on (transfer.target_school_id, transfer.target_student_id)
    transfer.target_school_id,
    transfer.target_student_id,
    coalesce(
      nullif(pg_catalog.btrim(source_enrollment.student_name_snapshot), ''),
      nullif(pg_catalog.btrim(student_profile.full_name), '')
    ) as student_name_snapshot,
    coalesce(
      nullif(pg_catalog.btrim(student_record.student_id), ''),
      nullif(pg_catalog.btrim(source_enrollment.student_code_snapshot), '')
    ) as student_code_snapshot,
    student_profile.photo_url as student_photo_snapshot
  from public.student_transfers as transfer
  left join public.student_enrollments as source_enrollment
    on source_enrollment.id = transfer.source_enrollment_id
  left join public.profiles as student_profile
    on student_profile.id = transfer.target_student_id
  left join public.students as student_record
    on student_record.id = transfer.target_student_id
  where transfer.status = 'completed'
    and transfer.target_school_id is not null
    and transfer.target_student_id is not null
  order by transfer.target_school_id, transfer.target_student_id,
    transfer.completed_at desc nulls last, transfer.created_at desc
)
update public.student_enrollments as target_enrollment
set student_name_snapshot = coalesce(
      nullif(pg_catalog.btrim(target_enrollment.student_name_snapshot), ''),
      transfer_identity.student_name_snapshot
    ),
    student_code_snapshot = coalesce(
      nullif(pg_catalog.btrim(target_enrollment.student_code_snapshot), ''),
      transfer_identity.student_code_snapshot
    ),
    student_photo_snapshot = coalesce(
      nullif(pg_catalog.btrim(target_enrollment.student_photo_snapshot), ''),
      transfer_identity.student_photo_snapshot
    )
from transfer_identity
where target_enrollment.student_id = transfer_identity.target_student_id
  and target_enrollment.school_id = transfer_identity.target_school_id
  and (
    nullif(pg_catalog.btrim(target_enrollment.student_name_snapshot), '') is null
    or nullif(pg_catalog.btrim(target_enrollment.student_code_snapshot), '') is null
    or nullif(pg_catalog.btrim(target_enrollment.student_photo_snapshot), '') is null
  );
