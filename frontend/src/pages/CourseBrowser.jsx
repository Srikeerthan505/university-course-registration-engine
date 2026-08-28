import SectionTable from '../components/SectionTable';

export default function CourseBrowser({ courses, onEnroll, activeSectionId, studentSelected }) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Course Browser</h2>
          <p className="text-sm text-slate-600">Live availability is refreshed after every enrollment or drop.</p>
        </div>
        {!studentSelected && <p className="text-sm font-medium text-amber-700">Choose a student to enroll.</p>}
      </div>
      <SectionTable
        courses={courses}
        onEnroll={onEnroll}
        activeSectionId={activeSectionId}
        disabled={!studentSelected}
      />
    </section>
  );
}
