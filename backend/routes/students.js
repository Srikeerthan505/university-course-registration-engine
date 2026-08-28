const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, email, credits_enrolled AS "creditsEnrolled"
      FROM students
      ORDER BY name;
    `);
    res.json({ students: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();

  if (!name || !email) {
    return res.status(400).json({
      error: 'Name and email are required.',
      code: 'INVALID_STUDENT',
    });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO students (name, email)
       VALUES ($1, $2)
       RETURNING id, name, email, credits_enrolled AS "creditsEnrolled";`,
      [name, email],
    );
    res.status(201).json({ student: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'A student with this email already exists.',
        code: 'DUPLICATE_EMAIL',
      });
    }
    next(error);
  }
});

router.get('/:id/schedule', async (req, res, next) => {
  try {
    const studentResult = await pool.query(
      `SELECT id, name, email, credits_enrolled AS "creditsEnrolled"
       FROM students WHERE id = $1;`,
      [req.params.id],
    );

    if (!studentResult.rowCount) {
      return res.status(404).json({ error: 'Student not found.', code: 'STUDENT_NOT_FOUND' });
    }

    const { rows: schedule } = await pool.query(
      `SELECT
         e.id AS "enrollmentId",
         e.status,
         c.code AS "courseCode",
         c.name AS "courseName",
         c.credits,
         s.id AS "sectionId",
         s.instructor,
         s.day_of_week AS "dayOfWeek",
         to_char(s.start_time, 'HH24:MI') AS "startTime",
         to_char(s.end_time, 'HH24:MI') AS "endTime",
         s.semester
       FROM enrollments e
       JOIN sections s ON s.id = e.section_id
       JOIN courses c ON c.id = s.course_id
       WHERE e.student_id = $1 AND e.status = 'enrolled'
       ORDER BY s.semester, s.day_of_week, s.start_time;`,
      [req.params.id],
    );

    res.json({ student: studentResult.rows[0], schedule });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
