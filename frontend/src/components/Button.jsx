export function Button({ children, onClick, disabled, loading, active, size, variant }) {
  const base = "rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-offset-1";
  const styles = {
    default: "bg-slate-900 text-white border-transparent hover:bg-slate-800 focus:ring-slate-900",
    outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-900",
    active: "bg-slate-900 text-white border-transparent",
  };
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2",
  };
  const cls = [base, styles[variant || "default"], active && styles.active, sizes[size || "md"]].filter(Boolean).join(" ");
  return (
    <button className={cls} onClick={onClick} disabled={disabled || loading}>
      {loading ? <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span> {children}</span> : children}
    </button>
  );
}
