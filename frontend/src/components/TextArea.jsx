export function TextArea({ label, value, onChange, rows, placeholder, disabled, helper }) {
  return (
    <div className="mb-4">
      {label && <label className="label" htmlFor={label}>{label}</label>}
      <textarea
        id={label}
        className="textarea"
        value={value || ""}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
      />
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}
