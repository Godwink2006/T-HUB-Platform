-- The attendance save RPC uses an empty search_path. Give the invoker trigger
-- function a fixed path so its unqualified timetable_lessons reference resolves.
alter function public.check_attendance_is_break()
  set search_path = public, pg_temp;
