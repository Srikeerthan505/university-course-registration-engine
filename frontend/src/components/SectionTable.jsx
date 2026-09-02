import EnrollButton from './EnrollButton';

function seatStyle(available, total) {
  if (available === 0) return 'bg-rose-100 text-rose-800';
  if (available <= 2 || available / total < 0.15) return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-100 text-emerald-800';
}

export default function SectionTable({ courses, onEnroll, activeSectionId, disabled }) {
  const sections = courses.flatMap((course) =>
    course.sections.map((section) => ({ ...section, course })),
  );

  if (!sections.length) {
    return <p className="p-6 text-slate-500">No sections are available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Course</th>
            <th className="px-4 py-3">Instructor</th>
            <th className="px-4 py-3">Schedule</th>
            <th className="px-4 py-3">Semester</th>
            <th className="px-4 py-3">Credits</th>
            <th className="px-4 py-3">Seats</th>
            <th className="px-4 py-3"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {sections.map(({ course, ...section }) => (
            <tr key={section.id} className="transition hover:bg-blue-50/40">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">{course.code}</p>
                <p className="text-slate-600">{course.name}</p>
              </td>
              <td className="px-4 py-3 text-slate-700">{section.instructor}</td>
              <td className="px-4 py-3 text-slate-700">
                {section.dayOfWeek} · {section.startTime}–{section.endTime}
              </td>
              <td className="px-4 py-3 text-slate-700">{section.semester}</td>
              <td className="px-4 py-3 text-slate-700">{course.credits}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${seatStyle(section.seatsAvailable, section.seatsTotal)}`}>
                  {section.seatsAvailable}/{section.seatsTotal}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <EnrollButton
                  disabled={disabled}
                  busy={activeSectionId === section.id}
                  onEnroll={() => onEnroll(section.id)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}