const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const enrollRouter = require('./routes/enroll');
const coursesRouter = require('./routes/courses');
const studentsRouter = require('./routes/students');

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      // Allow localhost for dev, and ANY Vercel URL for production
      if (!origin || origin.includes('localhost') || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  })
);

app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/enroll', enrollRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/students', studentsRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: error.message || 'An unexpected server error occurred.',
    code: error.code || 'INTERNAL_ERROR',
  });
});

app.listen(port, () => {
  console.log(`Course registration API listening on http://localhost:${port}`);
});