CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  credits_enrolled INTEGER DEFAULT 0
);

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  credits INTEGER NOT NULL
);

CREATE TABLE prerequisites (
  course_id UUID REFERENCES courses(id),
  required_course_id UUID REFERENCES courses(id),
  PRIMARY KEY (course_id, required_course_id)
);

CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id),
  instructor VARCHAR(100),
  seats_total INTEGER NOT NULL,
  seats_available INTEGER NOT NULL,
  day_of_week VARCHAR(10) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  semester VARCHAR(20) NOT NULL
);

CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  section_id UUID REFERENCES sections(id),
  enrolled_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'enrolled',
  UNIQUE(student_id, section_id)
);

CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  section_id UUID REFERENCES sections(id),
  position INTEGER NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW()
);
