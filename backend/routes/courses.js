const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/courses — every course with its sections and live seat counts.
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id,
        c.code,
        c.name,
        c.credits,
        COALESCE(
          json_agg(
            json_build_object(
              'id', s.id,
              'instructor', s.instructor,
              'seatsTotal', s.seats_total,
              'seatsAvailable', s.seats_available,
              'dayOfWeek', s.day_of_week,
              'startTime', to_char(s.start_time, 'HH24:MI'),
              'endTime', to_char(s.end_time, 'HH24:MI'),
              'semester', s.semester
            )
            ORDER BY s.semester, s.day_of_week, s.start_time
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) AS sections
      FROM courses c
      LEFT JOIN sections s ON s.course_id = c.id
      GROUP BY c.id, c.code, c.name, c.credits
      ORDER BY c.code;
    `);

    res.json({ courses: rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
