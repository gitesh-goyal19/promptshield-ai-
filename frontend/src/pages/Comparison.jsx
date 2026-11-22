import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export default function Comparison() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [runs, setRuns] = useState([]);
  const [runA, setRunA] = useState("");
  const [runB, setRunB] = useState("");
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    api.listProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) {
      setRuns([]);
      return;
    }
    // runs are per project; fetch via results? We don't have a list-runs endpoint.
    // Expose runs by querying tests? Instead, keep a simple manual entry of run IDs.
  }, [projectId]);

  const handleCompare = async () => {
    if (!projectId || !runA || !runB) {
      setError("Select project and both runs.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await api.compareRuns(projectId, runA, runB);
      setComparison(data);
      setInfo(data.note);
    } catch (e) {
      setError(e.message || "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  const cats = comparison?.category_counts || {};
  const categories = Object.keys(cats);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold">Comparison</h1>
        <Link to="/" className="text-sm text-slate-600 underline">← Dashboard</Link>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Compare two runs of the same approved tests. Shows per-category verdict counts, newly fixed failures, and new regressions.
      </p>

      <Card className="mb-6">
        <h3 className="font-semibold mb-3">Select runs</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="label block mb-1">Project</label>
            <select
              className="input"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setRuns([]);
                setRunA("");
                setRunB("");
                setComparison(null);
              }}
            >
              <option value="">-- choose a project --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label block mb-1">Run A (before)</label>
            <input
              className="input"
              value={runA}
              onChange={(e) => setRunA(e.target.value)}
              placeholder="run id"
            />
          </div>
          <div>
            <label className="label block mb-1">Run B (after)</label>
            <input
              className="input"
              value={runB}
              onChange={(e) => setRunB(e.target.value)}
              placeholder="run id"
            />
          </div>
          <div>
            <Button onClick={handleCompare} disabled={loading || !projectId || !runA || !runB}>
              {loading ? "Comparing…" : "Compare"}
            </Button>
          </div>
        </div>
        {error && (
          <div className="mt-3 p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-sm">{error}</div>
        )}
        {info && (
          <div className="mt-3 p-3 rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm">{info}</div>
        )}
      </Card>

      {!comparison ? null : (
        <>
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Summary</h3>
            <div className="flex gap-4 text-sm">
              <div className="card p-4">
                <div className="text-xs text-slate-500">Matched tests</div>
                <div className="text-2xl font-bold">{comparison.matched_tests}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-slate-500">Newly fixed</div>
                <div className="text-2xl font-bold text-emerald-700">{comparison.newly_fixed.length}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-slate-500">New regressions</div>
                <div className="text-2xl font-bold text-rose-700">{comparison.new_regressions.length}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-slate-500">Benign false-refusal rate</div>
                <div className="text-2xl font-bold">{comparison.benign_false_refusal_rate}%</div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">{comparison.note}</p>
          </div>

          {categories.length > 0 ? (
            <Card>
              <h3 className="font-semibold mb-3">Per-category verdict counts (Run B)</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categories.map((c) => ({ category: c, ...cats[c] }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Pass" fill="#10b981" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Fail" fill="#f43f5e" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Needs Review" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Error" fill="#6b7280" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Blocked by provider" fill="#a855f7" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : null}

          {(comparison.newly_fixed.length || comparison.new_regressions.length) && (
            <Card className="mt-6">
              <h3 className="font-semibold mb-3">Changes</h3>
              {comparison.newly_fixed.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-semibold text-emerald-700 mb-1">Newly fixed (Fail → Pass)</div>
                  <ul className="text-sm text-slate-700 list-disc pl-4">
                    {comparison.newly_fixed.map((f, i) => (
                      <li key={i}>Test {f.test_case_id} ({f.category})</li>
                    ))}
                  </ul>
                </div>
              )}
              {comparison.new_regressions.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-rose-700 mb-1">New regressions (Pass → Fail)</div>
                  <ul className="text-sm text-slate-700 list-disc pl-4">
                    {comparison.new_regressions.map((f, i) => (
                      <li key={i}>Test {f.test_case_id} ({f.category})</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
