export default function MySchedule({ student, schedule, busySectionId, onDrop }) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-900">My Schedule</h2>
        <p className="text-sm text-slate-600">
          {student ? `${student.name} · ${student.creditsEnrolled}/20 credits enrolled` : 'Choose a student to view a schedule.'}
        </p>
      </div>
      {!student ? null : schedule.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No current-semester enrollments.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {schedule.map((item) => (
            <div key={item.enrollmentId} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold text-slate-900">{item.courseCode} · {item.courseName}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.instructor} · {item.dayOfWeek} {item.startTime}–{item.endTime} · {item.credits} credits
                </p>
              </div>
              <button
                type="button"
                disabled={busySectionId === item.sectionId}
                onClick={() => onDrop(item.sectionId)}
                className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {busySectionId === item.sectionId ? 'Dropping…' : 'Drop'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
