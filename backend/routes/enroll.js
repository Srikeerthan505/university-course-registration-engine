const express = require('express');
const pool = require('../db/pool');

const router = express.Router();
const CREDIT_CAP = 20;

function requestError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function rollbackQuietly(client) {
  try {
    await client.query('ROLLBACK');
  } catch (_) {
    // The original error is more useful than a cleanup error.
  }
}

async function getMissingPrerequisites(client, studentId, courseId) {
  const { rows } = await client.query(
    `SELECT required.code
     FROM prerequisites p
     JOIN courses required ON required.id = p.required_course_id
     WHERE p.course_id = $1
       AND NOT EXISTS (
         SELECT 1
         FROM enrollments completed
         JOIN sections completed_section ON completed_section.id = completed.section_id
         WHERE completed.student_id = $2
           AND completed_section.course_id = p.required_course_id
           AND completed.status = 'completed'
       )
     ORDER BY required.code;`,
    [courseId, studentId],
  );
  return rows.map((row) => row.code);
}

async function findScheduleConflict(client, studentId, section) {
  const { rows } = await client.query(
    `SELECT c.code, c.name, s.day_of_week, s.start_time, s.end_time
     FROM enrollments e
     JOIN sections s ON s.id = e.section_id
     JOIN courses c ON c.id = s.course_id
     WHERE e.student_id = $1
       AND e.status = 'enrolled'
       AND s.semester = $2
       AND s.day_of_week = $3
       AND NOT ($4::time <= s.start_time OR $5::time >= s.end_time)
     LIMIT 1;`,
    [
      studentId,
      section.semester,
      section.day_of_week,
      section.start_time,
      section.end_time,
    ],
  );
  return rows[0];
}

// POST /api/enroll
// This flow intentionally keeps every decision between BEGIN and COMMIT. The
// section's PostgreSQL row lock is the concurrency boundary for seat inventory.
router.post('/', async (req, res, next) => {
  const { studentId, sectionId } = req.body;
  if (!studentId || !sectionId) {
    return res.status(400).json({
      error: 'studentId and sectionId are required.',
      code: 'INVALID_ENROLLMENT_REQUEST',
    });
  }

  const client = await pool.connect();
  let started = false;
  try {
    await client.query('BEGIN');
    started = true;

    const sectionResult = await client.query(
      'SELECT * FROM sections WHERE id = $1 FOR UPDATE;',
      [sectionId],
    );
    const section = sectionResult.rows[0];
    if (!section) {
      throw requestError(404, 'SECTION_NOT_FOUND', 'The selected section does not exist.');
    }

    // The section row is locked before this inventory check, so concurrent
    // requests cannot both observe and claim the same final seat.
    if (section.seats_available <= 0) {
      await client.query('ROLLBACK');
      started = false;
      return res.status(409).json({
        error: 'This section is full.',
        code: 'SECTION_FULL',
      });
    }

    const courseResult = await client.query(
      'SELECT code, name, credits FROM courses WHERE id = $1;',
      [section.course_id],
    );
    const course = courseResult.rows[0];
    if (!course) {
      throw requestError(404, 'COURSE_NOT_FOUND', 'The course for the selected section does not exist.');
    }

    // This lock serializes a single student's concurrent requests for different
    // sections, keeping the 20-credit check and credits_enrolled update correct.
    const studentResult = await client.query(
      `SELECT id, name, credits_enrolled FROM students WHERE id = $1 FOR UPDATE;`,
      [studentId],
    );
    const student = studentResult.rows[0];
    if (!student) {
      throw requestError(404, 'STUDENT_NOT_FOUND', 'The selected student does not exist.');
    }

    const existingEnrollment = await client.query(
      `SELECT id FROM enrollments WHERE student_id = $1 AND section_id = $2;`,
      [studentId, sectionId],
    );
    if (existingEnrollment.rowCount) {
      throw requestError(409, 'ALREADY_ENROLLED', 'The student is already enrolled in this section.');
    }

    const missingPrerequisites = await getMissingPrerequisites(client, studentId, section.course_id);
    if (missingPrerequisites.length) {
      throw requestError(
        422,
        'PREREQUISITES_NOT_MET',
        `Missing prerequisite${missingPrerequisites.length > 1 ? 's' : ''}: ${missingPrerequisites.join(', ')}.`,
      );
    }

    if (student.credits_enrolled + course.credits > CREDIT_CAP) {
      throw requestError(
        422,
        'CREDIT_CAP_EXCEEDED',
        `Enrollment would exceed the ${CREDIT_CAP}-credit semester cap.`,
      );
    }

    const conflict = await findScheduleConflict(client, studentId, section);
    if (conflict) {
      throw requestError(
        422,
        'SCHEDULE_CONFLICT',
        `Schedule conflict with ${conflict.code} (${conflict.day_of_week} ${String(conflict.start_time).slice(0, 5)}-${String(conflict.end_time).slice(0, 5)}).`,
      );
    }

    const seatUpdate = await client.query(
      `UPDATE sections
       SET seats_available = seats_available - 1
       WHERE id = $1
       RETURNING seats_available;`,
      [sectionId],
    );
    if (!seatUpdate.rowCount) {
      throw requestError(409, 'SECTION_FULL', 'The final seat was claimed by another enrollment.');
    }

    await client.query(
      `INSERT INTO enrollments (student_id, section_id, status)
       VALUES ($1, $2, 'enrolled');`,
      [studentId, sectionId],
    );
    await client.query(
      `UPDATE students
       SET credits_enrolled = credits_enrolled + $1
       WHERE id = $2;`,
      [course.credits, studentId],
    );

    await client.query('COMMIT');
    res.status(201).json({
      status: 'enrolled',
      message: `Enrolled in ${course.code}.`,
      seatsAvailable: seatUpdate.rows[0].seats_available,
    });
  } catch (error) {
    if (started) await rollbackQuietly(client);
    next(error);
  } finally {
    client.release();
  }
});

// DELETE /api/enroll — drop, free a seat, and promote exactly the first
// waitlisted student within the same database transaction.
router.delete('/', async (req, res, next) => {
  const { studentId, sectionId } = req.body;
  if (!studentId || !sectionId) {
    return res.status(400).json({
      error: 'studentId and sectionId are required.',
      code: 'INVALID_DROP_REQUEST',
    });
  }

  const client = await pool.connect();
  let started = false;
  try {
    await client.query('BEGIN');
    started = true;

    const sectionResult = await client.query(
      `SELECT s.*, c.code AS course_code, c.credits
       FROM sections s
       JOIN courses c ON c.id = s.course_id
       WHERE s.id = $1
       FOR UPDATE OF s;`,
      [sectionId],
    );
    const section = sectionResult.rows[0];
    if (!section) {
      throw requestError(404, 'SECTION_NOT_FOUND', 'The selected section does not exist.');
    }

    const enrollment = await client.query(
      `SELECT id FROM enrollments
       WHERE student_id = $1 AND section_id = $2 AND status = 'enrolled'
       FOR UPDATE;`,
      [studentId, sectionId],
    );
    if (!enrollment.rowCount) {
      throw requestError(404, 'ENROLLMENT_NOT_FOUND', 'The student is not enrolled in this section.');
    }

    const droppingStudent = await client.query(
      `SELECT id FROM students WHERE id = $1 FOR UPDATE;`,
      [studentId],
    );
    if (!droppingStudent.rowCount) {
      throw requestError(404, 'STUDENT_NOT_FOUND', 'The selected student does not exist.');
    }

    await client.query('DELETE FROM enrollments WHERE id = $1;', [enrollment.rows[0].id]);
    await client.query(
      `UPDATE students
       SET credits_enrolled = GREATEST(credits_enrolled - $1, 0)
       WHERE id = $2;`,
      [section.credits, studentId],
    );
    const releasedSeat = await client.query(
      `UPDATE sections
       SET seats_available = seats_available + 1
       WHERE id = $1
       RETURNING seats_available;`,
      [sectionId],
    );

    const nextWaitlist = await client.query(
      `SELECT id, student_id, position
       FROM waitlist
       WHERE section_id = $1
       ORDER BY position ASC, joined_at ASC, id ASC
       LIMIT 1
       FOR UPDATE;`,
      [sectionId],
    );

    let promotedStudentId = null;
    let seatsAvailable = releasedSeat.rows[0].seats_available;
    if (nextWaitlist.rowCount) {
      const next = nextWaitlist.rows[0];
      await client.query(`SELECT id FROM students WHERE id = $1 FOR UPDATE;`, [next.student_id]);
      await client.query(
        `INSERT INTO enrollments (student_id, section_id, status)
         VALUES ($1, $2, 'enrolled');`,
        [next.student_id, sectionId],
      );
      await client.query(
        `UPDATE students
         SET credits_enrolled = credits_enrolled + $1
         WHERE id = $2;`,
        [section.credits, next.student_id],
      );
      const occupiedSeat = await client.query(
        `UPDATE sections
         SET seats_available = seats_available - 1
         WHERE id = $1 AND seats_available > 0
         RETURNING seats_available;`,
        [sectionId],
      );
      if (!occupiedSeat.rowCount) {
        throw requestError(409, 'PROMOTION_FAILED', 'The released seat could not be assigned.');
      }
      await client.query('DELETE FROM waitlist WHERE id = $1;', [next.id]);
      await client.query(
        `UPDATE waitlist
         SET position = position - 1
         WHERE section_id = $1 AND position > $2;`,
        [sectionId, next.position],
      );
      promotedStudentId = next.student_id;
      seatsAvailable = occupiedSeat.rows[0].seats_available;
    }

    await client.query('COMMIT');
    res.json({
      status: 'dropped',
      message: promotedStudentId
        ? 'Course dropped and the first waitlisted student was promoted.'
        : 'Course dropped and a seat is now available.',
      promotedStudentId,
      seatsAvailable,
    });
  } catch (error) {
    if (started) await rollbackQuietly(client);
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
