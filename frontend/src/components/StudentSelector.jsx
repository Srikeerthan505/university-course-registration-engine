export default function StudentSelector({ students, selectedStudentId, onChange, disabled }) {
  return (
    <label className="flex min-w-64 flex-col gap-1 text-sm font-medium text-slate-700">
      Active student
      <select
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm"
        value={selectedStudentId || ''}
        disabled={disabled || students.length === 0}
        onChange={(event) => onChange(event.target.value)}
      >
        {students.length === 0 ? (
          <option value="">No students found</option>
        ) : (
          students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name} — {student.creditsEnrolled}/20 credits
            </option>
          ))
        )}
      </select>
    </label>
  );
}
