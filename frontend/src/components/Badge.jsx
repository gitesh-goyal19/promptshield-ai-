const kinds = {
  pass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  fail: "border-rose-200 bg-rose-50 text-rose-700",
  review: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-slate-200 bg-slate-50 text-slate-700",
  blocked: "border-purple-200 bg-purple-50 text-purple-700",
};

export function Badge({ label, kind }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${kinds[kind] || kinds.error}`}>
      {label}
    </span>
  );
}
