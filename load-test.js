/*
 * Concurrency proof for the PostgreSQL row lock in POST /api/enroll.
 * Start the API first, then run: node load-test.js
 */
const crypto = require('crypto');
const pool = require('./backend/db/pool');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/api';
const REQUEST_COUNT = 50;
const SEATS_TOTAL = 10;

async function main() {
  if (typeof fetch !== 'function') {
    throw new Error('This script requires Node.js 18+ for the built-in fetch API.');
  }

  const runId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const courseCode = `RACE${runId.slice(0, 12)}`;
  const { rows: courseRows } = await pool.query(
    `INSERT INTO courses (code, name, credits)
     VALUES ($1, $2, 3)
     RETURNING id;`,
    [courseCode, `Concurrency Proof ${runId}`],
  );
  const courseId = courseRows[0].id;

  const { rows: sectionRows } = await pool.query(
    `INSERT INTO sections (
       course_id, instructor, seats_total, seats_available,
       day_of_week, start_time, end_time, semester
     ) VALUES ($1, 'Load Test', $2, $2, 'Saturday', '08:00', '09:00', 'Load Test')
     RETURNING id;`,
    [courseId, SEATS_TOTAL],
  );
  const sectionId = sectionRows[0].id;

  const studentIds = await Promise.all(
    Array.from({ length: REQUEST_COUNT }, async (_, index) => {
      const { rows } = await pool.query(
        `INSERT INTO students (name, email)
         VALUES ($1, $2)
         RETURNING id;`,
        [`Load Test Student ${index + 1}`, `load-test-${runId}-${index + 1}@example.test`],
      );
      return rows[0].id;
    }),
  );

  console.log(`Firing ${REQUEST_COUNT} simultaneous enrollment attempts at section ${sectionId} (${SEATS_TOTAL} seats)…`);
  const attempts = await Promise.all(
    studentIds.map(async (studentId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/enroll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId, sectionId }),
        });
        const body = await response.json().catch(() => ({}));
        return { httpStatus: response.status, body };
      } catch (error) {
        return { httpStatus: 0, body: { error: error.message } };
      }
    }),
  );

  const enrolledResponses = attempts.filter((result) => result.httpStatus === 201).length;
  const fullResponses = attempts.filter((result) => result.httpStatus === 409).length;
  const failedResponses = attempts.filter((result) => ![201, 409].includes(result.httpStatus)).length;

  const { rows: verificationRows } = await pool.query(
    `SELECT
       s.seats_total,
       s.seats_available,
       (SELECT COUNT(*)::integer FROM enrollments e
        WHERE e.section_id = s.id AND e.status = 'enrolled') AS enrolled_count,
       (SELECT COUNT(*)::integer FROM waitlist w
        WHERE w.section_id = s.id) AS waitlist_count
     FROM sections s
     WHERE s.id = $1;`,
    [sectionId],
  );
  const verification = verificationRows[0];

  console.log(`Responses — enrolled: ${enrolledResponses}, full: ${fullResponses}, failed: ${failedResponses}`);
  console.log(
    `Database — enrolled: ${verification.enrolled_count}/${verification.seats_total}, ` +
      `seats_available: ${verification.seats_available}, waitlist: ${verification.waitlist_count}`,
  );

  const enrolledCount = Number(verification.enrolled_count);
  const seatsTotal = Number(verification.seats_total);
  if (failedResponses > 0) {
    throw new Error(`LOAD TEST REQUEST FAILURE: ${failedResponses} requests did not enroll or join the waitlist.`);
  }
  if (enrolledCount > seatsTotal) {
    throw new Error(
      `CONCURRENCY ASSERTION FAILED: ${enrolledCount} enrollments exceeded ${seatsTotal} available seats.`,
    );
  }
  if (Number(verification.seats_available) !== seatsTotal - enrolledCount) {
    throw new Error('INVENTORY ASSERTION FAILED: seats_available does not match enrolled count.');
  }
  console.log('PASS: enrolled count never exceeded seats_total and inventory is consistent.');
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
