export default function EnrollButton({ disabled, busy, onEnroll }) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onEnroll}
      className="rounded-md bg-campus px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {busy ? 'Enrolling…' : 'Enroll'}
    </button>
  );
}
