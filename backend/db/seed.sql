-- Idempotent seed data. Run after schema.sql.

INSERT INTO courses (code, name, credits) VALUES
  ('CS101', 'Introduction to Programming', 3),
  ('CS201', 'Data Structures', 3),
  ('CS301', 'Algorithms', 3),
  ('CS401', 'Database Systems', 3),
  ('MATH101', 'Calculus I', 4),
  ('MATH201', 'Discrete Mathematics', 3),
  ('PHY101', 'General Physics I', 4),
  ('ENG101', 'Academic Writing', 3),
  ('BIO101', 'Principles of Biology', 4),
  ('HIST101', 'World History', 3)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, credits = EXCLUDED.credits;

INSERT INTO prerequisites (course_id, required_course_id)
SELECT course_row.id, required_row.id
FROM (VALUES
  ('CS201', 'CS101'),
  ('CS301', 'CS201'),
  ('CS401', 'CS201'),
  ('MATH201', 'MATH101')
) AS required(course_code, required_code)
JOIN courses course_row ON course_row.code = required.course_code
JOIN courses required_row ON required_row.code = required.required_code
ON CONFLICT DO NOTHING;

INSERT INTO sections (
  course_id, instructor, seats_total, seats_available,
  day_of_week, start_time, end_time, semester
)
SELECT
  c.id, seed.instructor, seed.seats_total, seed.seats_available,
  seed.day_of_week, seed.start_time::time, seed.end_time::time, seed.semester
FROM (VALUES
  ('CS101', 'Dr. Ada Kim',       30, 30, 'Monday',    '09:00', '10:15', 'Fall 2026'),
  ('CS101', 'Dr. Ada Kim',       30, 28, 'Tuesday',   '11:00', '12:15', 'Fall 2026'),
  ('CS101', 'Prof. Lin Chen',    20, 20, 'Wednesday', '15:00', '16:15', 'Fall 2026'),
  ('CS201', 'Dr. Grace Hopper',  30,  1, 'Monday',    '11:00', '12:15', 'Fall 2026'),
  ('CS201', 'Dr. Grace Hopper',  30, 28, 'Thursday',  '14:00', '15:15', 'Fall 2026'),
  ('CS301', 'Prof. Edsger Dijk', 25, 25, 'Tuesday',   '09:00', '10:15', 'Fall 2026'),
  ('CS301', 'Prof. Edsger Dijk', 25, 25, 'Friday',    '10:00', '11:15', 'Fall 2026'),
  ('CS401', 'Dr. Codd Stone',    10, 10, 'Wednesday', '10:00', '11:15', 'Fall 2026'),
  ('CS401', 'Dr. Codd Stone',    25, 25, 'Thursday',  '09:00', '10:15', 'Fall 2026'),
  ('CS401', 'Dr. Codd Stone',    25,  2, 'Friday',    '13:00', '14:15', 'Fall 2026'),
  ('MATH101', 'Dr. Emmy Noether',35,  2, 'Monday',    '10:00', '11:15', 'Fall 2026'),
  ('MATH101', 'Dr. Emmy Noether',35, 35, 'Tuesday',   '15:00', '16:15', 'Fall 2026'),
  ('MATH201', 'Prof. George Bool',30, 30, 'Wednesday','11:00', '12:15', 'Fall 2026'),
  ('MATH201', 'Prof. George Bool',30, 30, 'Thursday', '13:00', '14:15', 'Fall 2026'),
  ('PHY101', 'Dr. Marie Curie',  24, 24, 'Tuesday',   '10:00', '11:15', 'Fall 2026'),
  ('PHY101', 'Dr. Marie Curie',  24, 24, 'Friday',    '11:00', '12:15', 'Fall 2026'),
  ('ENG101', 'Prof. Maya Angelou',28,28,'Monday',     '13:00', '14:15', 'Fall 2026'),
  ('ENG101', 'Prof. Maya Angelou',28,28,'Wednesday',  '14:00', '15:15', 'Fall 2026'),
  ('BIO101', 'Dr. Rosalind Frank',26,26,'Tuesday',    '13:00', '14:15', 'Fall 2026'),
  ('BIO101', 'Dr. Rosalind Frank',26,26,'Thursday',   '15:00', '16:15', 'Fall 2026'),
  ('HIST101', 'Prof. Howard Zinn',32,32,'Monday',     '14:00', '15:15', 'Fall 2026'),
  ('HIST101', 'Prof. Howard Zinn',32,32,'Friday',     '09:00', '10:15', 'Fall 2026')
) AS seed(course_code, instructor, seats_total, seats_available, day_of_week, start_time, end_time, semester)
JOIN courses c ON c.code = seed.course_code
WHERE NOT EXISTS (
  SELECT 1
  FROM sections existing
  WHERE existing.course_id = c.id
    AND existing.instructor = seed.instructor
    AND existing.day_of_week = seed.day_of_week
    AND existing.start_time = seed.start_time::time
    AND existing.semester = seed.semester
);

INSERT INTO students (name, email) VALUES
  ('Alice Johnson', 'alice.johnson@university.edu'),
  ('Ben Williams', 'ben.williams@university.edu'),
  ('Carla Martinez', 'carla.martinez@university.edu'),
  ('Dev Patel', 'dev.patel@university.edu'),
  ('Elena Rossi', 'elena.rossi@university.edu')
ON CONFLICT (email) DO NOTHING;

-- Completion records support prerequisite validation. They intentionally do
-- not change credits_enrolled, which tracks the currently enrolled semester.
INSERT INTO enrollments (student_id, section_id, status)
SELECT student_row.id, section_row.id, 'completed'
FROM (VALUES
  ('alice.johnson@university.edu', 'CS101', 'Dr. Ada Kim', 'Monday'),
  ('alice.johnson@university.edu', 'MATH101', 'Dr. Emmy Noether', 'Monday'),
  ('ben.williams@university.edu', 'CS101', 'Dr. Ada Kim', 'Tuesday'),
  ('dev.patel@university.edu', 'CS101', 'Dr. Ada Kim', 'Wednesday'),
  ('dev.patel@university.edu', 'CS201', 'Dr. Grace Hopper', 'Thursday'),
  ('elena.rossi@university.edu', 'MATH101', 'Dr. Emmy Noether', 'Tuesday')
) AS completion(student_email, course_code, instructor, day_of_week)
JOIN students student_row ON student_row.email = completion.student_email
JOIN courses course_row ON course_row.code = completion.course_code
JOIN sections section_row
  ON section_row.course_id = course_row.id
 AND section_row.instructor = completion.instructor
 AND section_row.day_of_week = completion.day_of_week
 AND section_row.semester = 'Fall 2026'
ON CONFLICT (student_id, section_id) DO NOTHING;
