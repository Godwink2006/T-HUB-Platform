CREATE OR REPLACE FUNCTION public.check_class_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
    current_count integer;
    max_capacity integer;
    class_name text;
    target_school_id uuid;
BEGIN
    SELECT c.capacity, c.name, c.school_id
    INTO max_capacity, class_name, target_school_id
    FROM public.classes AS c
    WHERE c.id = NEW.class_id;

    IF max_capacity IS NOT NULL THEN
        SELECT count(*)
        INTO current_count
        FROM public.student_enrollments AS se
        WHERE se.class_id = NEW.class_id
          AND se.academic_year_id = NEW.academic_year_id
          AND se.term_id = NEW.term_id
          AND se.school_id = target_school_id;

        IF current_count >= max_capacity THEN
            RAISE EXCEPTION 'Enrollment blocked: Class "%" has reached its maximum capacity of % students.', class_name, max_capacity;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_student_direct_class_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
    current_count integer;
    max_capacity integer;
    class_name text;
    target_school_id uuid;
BEGIN
    IF NEW.class_id IS NOT NULL THEN
        SELECT c.capacity, c.name, c.school_id
        INTO max_capacity, class_name, target_school_id
        FROM public.classes AS c
        WHERE c.id = NEW.class_id;

        IF max_capacity IS NOT NULL THEN
            SELECT count(*)
            INTO current_count
            FROM public.students AS s
            WHERE s.class_id = NEW.class_id
              AND s.school_id = target_school_id;

            IF TG_OP = 'UPDATE' AND OLD.class_id = NEW.class_id THEN
                current_count := current_count - 1;
            END IF;

            IF current_count >= max_capacity THEN
                RAISE EXCEPTION 'Registration blocked: Class "%" has reached its maximum capacity of % students.', class_name, max_capacity;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
