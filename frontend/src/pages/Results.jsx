import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../services/api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Input } from "../components/Input";
import { TextArea } from "../components/TextArea";

const VERDICT_KIND = {
  Pass: "pass",
  Fail: "fail",
  "Needs Review": "review",
  Error: "error",
  "Blocked by provider": "blocked",
};

export default function Results() {
  const { runId } = useParams();
  const [run, setRun] = useState(null);
  const [results, setResults] = useState([]);
  const [verdictFilter, setVerdictFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState(null);
  const [editReason, setEditReason] = useState("");

  useEffect(() => {
    load();
  }, [runId]);

  const load = async () => {
    try {
      setLoading(true);
      const [r, res] = await Promise.all([api.getRun(runId), api.getRunResults(runId)]);
      setRun(r);
      setResults(res);
    } catch (e) {
      setError(e.message || "Failed to load results");
    } finally {
      setLoading(false);
    }
  };

  const filtered = results.filter((r) => {
    if (verdictFilter !== "all" && r.verdict !== verdictFilter) return false;
    if (search) {
      const haystack = `${r.test_case?.attack_prompt || ""} ${r.model_response || ""} ${r.verdict}`.toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const submitOverride = async (id, currentVerdict) => {
    const newVerdict =
      currentVerdict === "Pass" ? "Fail" : currentVerdict === "Fail" ? "Pass" : "Needs Review";
    try {
      await api.updateResultReview(id, { new_verdict: newVerdict, reason: editReason || "Manual override" });
      load();
      setEditId(null);
      setEditReason("");
    } catch (e) {
      setError(e.message || "Override failed");
    }
  };

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <div className="text-rose-700 text-sm">{error}</div>;
  if (!run) return <p className="text-slate-500">Run not found.</p>;

  const counts = results.reduce((acc, r) => { acc[r.verdict] = (acc[r.verdict] || 0) + 1; return acc; }, {});

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Run Results</h1>
          <p className="text-sm text-slate-500">Run {run.id} · mode {run.mode} · status {run.status}</p>
        </div>
        <Link to="/">← Back to dashboard</Link>
      </div>

      <Card className="mb-6">
        <h3 className="font-semibold mb-3">Filters</h3>
        <div className="flex gap-3 items-end">
          <select
            className="input"
            value={verdictFilter}
            onChange={(e) => setVerdictFilter(e.target.value)}
          >
            <option value="all">All verdicts</option>
            <option value="Pass">Pass</option>
            <option value="Fail">Fail</option>
            <option value="Needs Review">Needs Review</option>
            <option value="Error">Error</option>
            <option value="Blocked by provider">Blocked</option>
          </select>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search test/response/verdict" />
          <p className="text-xs text-slate-500">{filtered.length} of {results.length} results</p>
        </div>
      </Card>

      <div className="flex gap-4 mb-3 text-sm">
        {["Pass", "Fail", "Needs Review", "Error", "Blocked by provider"].map((v) => (
          <div key={v} className="flex items-center gap-1">
            <Badge label={v} kind={VERDICT_KIND[v] || "error"} />
            <span className="font-semibold">{counts[v] || 0}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left pb-2 text-slate-500">Test</th>
              <th className="text-left pb-2 text-slate-500">Verdict</th>
              <th className="text-left pb-2 text-slate-500">Response</th>
              <th className="text-left pb-2 text-slate-500">Reason</th>
              <th className="text-left pb-2 text-slate-500">Override</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50 group">
                <td className="py-2">
                  <span className="text-xs font-mono text-slate-500 block">{r.test_case?.test_id || r.test_case_id}</span>
                  <div className="text-xs text-slate-500 truncate max-w-[220px]">{r.test_case?.attack_prompt || ""}</div>
                </td>
                <td className="py-2">
                  <Badge label={r.verdict} kind={VERDICT_KIND[r.verdict] || "error"} />
                </td>
                <td className="py-2">
                  <div className="text-xs text-slate-600 truncate max-w-[260px]">{r.model_response || r.error || "—"}</div>
                </td>
                <td className="py-2">
                  <div className="text-xs text-slate-500 truncate max-w-[220px]">{r.reason || "—"}</div>
                  {r.evidence && (
                    <div className="text-xs text-slate-400 truncate max-w-[220px] mt-1">evidence: {r.evidence}</div>
                  )}
                </td>
                <td className="py-2">
                  {editId === r.id ? (
                    <div className="flex gap-2">
                      <TextArea value={editReason} onChange={(e) => setEditReason(e.target.value)} rows={2} placeholder="Reason…" />
                      <div className="flex gap-1">
                        <Button onClick={() => submitOverride(r.id, r.verdict)} size="sm">Save</Button>
                        <Button variant="outline" onClick={() => { setEditId(null); setEditReason(""); }} size="sm">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button onClick={() => setEditId(r.id)} size="sm" variant="outline">Override verdict</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
