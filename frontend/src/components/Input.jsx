export function Input({ label, value, onChange, placeholder, required, disabled, helper }) {
  return (
    <div className="mb-4">
      {label && <label className="label" htmlFor={label}>{label}{required && <span className="text-rose-500 ml-1" aria-hidden="true">*</span>}</label>}
      <input
        id={label}
        className="input"
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}
