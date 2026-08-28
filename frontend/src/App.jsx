import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import StudentSelector from './components/StudentSelector';
import CourseBrowser from './pages/CourseBrowser';
import MySchedule from './pages/MySchedule';

function messageFrom(error) {
  return error?.message || 'Something went wrong. Please try again.';
}

export default function App() {
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busySectionId, setBusySectionId] = useState('');
  const [notice, setNotice] = useState(null);

  const refreshCourses = useCallback(async () => {
    const result = await api.getCourses();
    setCourses(result.courses);
  }, []);

  const refreshStudents = useCallback(async () => {
    const result = await api.getStudents();
    setStudents(result.students);
    return result.students;
  }, []);

  const refreshSchedule = useCallback(async (studentId) => {
    if (!studentId) {
      setSchedule([]);
      setSelectedStudent(null);
      return;
    }
    const result = await api.getSchedule(studentId);
    setSelectedStudent(result.student);
    setSchedule(result.schedule);
  }, []);

  useEffect(() => {
    async function initialize() {
      try {
        const [seedStudents] = await Promise.all([refreshStudents(), refreshCourses()]);
        if (seedStudents.length) setSelectedStudentId(seedStudents[0].id);
      } catch (error) {
        setNotice({ type: 'error', text: messageFrom(error) });
      } finally {
        setLoading(false);
      }
    }
    initialize();
  }, [refreshCourses, refreshStudents]);

  useEffect(() => {
    refreshSchedule(selectedStudentId).catch((error) => setNotice({ type: 'error', text: messageFrom(error) }));
  }, [selectedStudentId, refreshSchedule]);

  async function refreshAfterMutation() {
    await Promise.all([refreshCourses(), refreshStudents(), refreshSchedule(selectedStudentId)]);
  }

  async function handleEnroll(sectionId) {
    if (!selectedStudentId) return;
    setBusySectionId(sectionId);
    setNotice(null);
    try {
      const result = await api.enroll(selectedStudentId, sectionId);
      setNotice({ type: result.status === 'waitlisted' ? 'info' : 'success', text: result.message });
    } catch (error) {
      setNotice({ type: 'error', text: messageFrom(error) });
    } finally {
      try {
        await refreshAfterMutation();
      } catch (error) {
        setNotice({ type: 'error', text: messageFrom(error) });
      }
      setBusySectionId('');
    }
  }

  async function handleDrop(sectionId) {
    if (!selectedStudentId) return;
    setBusySectionId(sectionId);
    setNotice(null);
    try {
      const result = await api.drop(selectedStudentId, sectionId);
      setNotice({ type: 'success', text: result.message });
    } catch (error) {
      setNotice({ type: 'error', text: messageFrom(error) });
    } finally {
      try {
        await refreshAfterMutation();
      } catch (error) {
        setNotice({ type: 'error', text: messageFrom(error) });
      }
      setBusySectionId('');
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-1 text-sm font-bold uppercase tracking-[0.18em] text-campus">Registrar Console</p>
          <h1 className="text-3xl font-black tracking-tight text-ink">University Course Registration</h1>
          <p className="mt-2 max-w-2xl text-slate-600">A PostgreSQL-backed enrollment engine with row-level seat locking and in-transaction academic validation.</p>
        </div>
        <StudentSelector
          students={students}
          selectedStudentId={selectedStudentId}
          onChange={setSelectedStudentId}
          disabled={loading}
        />
      </header>

      {notice && (
        <div
          role="status"
          className={`mb-5 rounded-lg border px-4 py-3 text-sm font-medium ${
            notice.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : notice.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-blue-200 bg-blue-50 text-blue-800'
          }`}
        >
          {notice.text}
        </div>
      )}

      {loading ? (
        <p className="rounded-xl bg-white p-6 text-slate-600 shadow-sm">Loading registrar data…</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <CourseBrowser
            courses={courses}
            onEnroll={handleEnroll}
            activeSectionId={busySectionId}
            studentSelected={Boolean(selectedStudentId)}
          />
          <MySchedule
            student={selectedStudent}
            schedule={schedule}
            busySectionId={busySectionId}
            onDrop={handleDrop}
          />
        </div>
      )}
    </main>
  );
}
