import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";

const VERDICT_KIND = {
  Pass: "pass",
  Fail: "fail",
  "Needs Review": "review",
  Error: "error",
  "Blocked by provider": "blocked",
};

export default function TestRunner() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [targets, setTargets] = useState([]);
  const [targetId, setTargetId] = useState("");
  const [versions, setVersions] = useState([]);
  const [versionId, setVersionId] = useState("");
  const [maxTests, setMaxTests] = useState(15);
  const [run, setRun] = useState(null);
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle"); // idle|running|completed
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const pollRef = useRef(null);

  useEffect(() => {
    api.listProjects().then(setProjects).catch(() => {});
  }, []);

  const loadProjectData = async (id) => {
    try {
      const [tgs, vs] = await Promise.all([
        fetch(`/api/projects/${id}/targets`).then((r) => r.json()),
        fetch(`/api/projects/${id}/prompts`).then((r) => r.json()),
      ]);
      setTargets(tgs);
      setVersions(vs);
    } catch (e) {
      setError("Failed to load project data");
    }
  };

  useEffect(() => {
    if (projectId) loadProjectData(projectId);
    setTargets([]);
    setVersions([]);
    setTargetId("");
    setVersionId("");
    setRun(null);
    setResults([]);
    setStatus("idle");
    setInfo("");
  }, [projectId]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollResults = async () => {
    if (!run) return;
    try {
      const data = await api.getRunResults(run.id);
      setResults(data);
      const r = await api.getRun(run.id);
      if (r.status !== "running" && r.status !== "cancelling") {
        setStatus("completed");
        setRun(r);
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch (e) {
      // ignore poll errors mid-run
    }
  };

  const handleRun = async () => {
    if (!projectId || !targetId || !versionId) {
      setError("Select project, target, and prompt version.");
      return;
    }
    setError("");
    setResults([]);
    setStatus("running");
    try {
      const created = await api.createRun(projectId, {
        target_id: parseInt(targetId, 10),
        prompt_version_id: parseInt(versionId, 10),
        mode: "gemini",
        settings: { temperature: 0.7 },
        max_tests: parseInt(maxTests, 10) || 15,
      });
      setRun(created);
      setInfo("Run started. Tests run sequentially.");
      pollRef.current = setInterval(pollResults, 3000);
      pollResults();
    } catch (e) {
      setError(e.message || "Failed to start run");
      setStatus("idle");
    }
  };

  const handleCancel = async () => {
    if (!run) return;
    try {
      await api.cancelRun(run.id);
      setStatus("cancelling");
    } catch (e) {
      setError(e.message || "Cancel failed");
    }
  };

  const counts = results.reduce(
    (acc, r) => {
      acc[r.verdict] = (acc[r.verdict] || 0) + 1;
      return acc;
    },
    {},
  );

  if (!projectId) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Test Runner</h1>
        <p className="text-slate-500">Select a project to run approved tests.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold">Test Runner</h1>
        <Link to="/" className="text-sm text-slate-600 underline">← Dashboard</Link>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Run approved tests one at a time against a prompt version. Results are saved with the exact prompt, model, and settings used.
      </p>

      <Card className="mb-6">
        <h3 className="font-semibold mb-3">Configure run</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="label block mb-1">Target</label>
            <select
              className="input"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              disabled={loading || status === "running"}
            >
              <option value="">-- choose target --</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.model_id} ({t.provider})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label block mb-1">Prompt version</label>
            <select
              className="input"
              value={versionId}
              onChange={(e) => setVersionId(e.target.value)}
              disabled={loading || status === "running"}
            >
              <option value="">-- choose version --</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>v{v.version_no}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label block mb-1">Max tests</label>
            <Input value={String(maxTests)} onChange={(e) => setMaxTests(e.target.value)} placeholder="15" />
          </div>
          <div>
            <Button onClick={handleRun} disabled={loading || status === "running" || !targetId || !versionId}>
              {status === "running" ? "Running…" : "Run approved tests"}
            </Button>
          </div>
        </div>
        {error && (
          <div className="mt-3 p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-sm">{error}</div>
        )}
        {info && (
          <div className="mt-3 p-3 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{info}</div>
        )}
      </Card>

      {run && (
        <Card className="mb-6">
          <h3 className="font-semibold mb-3">Run status</h3>
          <div className="flex items-center gap-3 mb-3">
            <Badge
              label={run.status}
              kind={run.status === "completed" ? "pass" : run.status === "error" ? "error" : "review"}
            />
            <span className="text-sm text-slate-500">Mode: {run.mode}</span>
            {run.status === "running" && (
              <span className="text-xs animate-pulse text-slate-500">executing tests sequentially…</span>
            )}
          </div>
          <div className="flex gap-3">
            {run.status === "running" && (
              <Button onClick={handleCancel} variant="outline" size="sm">Cancel run</Button>
            )}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="font-semibold mb-3">Results</h3>
        <div className="flex gap-4 mb-3 text-sm">
          {Object.entries(counts).map(([v, c]) => (
            <div key={v} className="flex items-center gap-1">
              <Badge label={v} kind={VERDICT_KIND[v] || "error"} />
              <span className="font-semibold">{c}</span>
            </div>
          ))}
        </div>
        {results.length === 0 && status !== "running" && (
          <p className="text-slate-500">No results yet. Start a run above.</p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left pb-2 text-slate-500">Test</th>
                <th className="text-left pb-2 text-slate-500">Verdict</th>
                <th className="text-left pb-2 text-slate-500">Response</th>
                <th className="text-left pb-2 text-slate-500">Latency</th>
                <th className="text-left pb-2 text-slate-500">Error</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-2">
                    <span className="text-xs font-mono text-slate-500">{r.test_case?.test_id || r.test_case_id}</span>
                    <div className="text-xs text-slate-500 truncate max-w-[200px]">
                      {r.test_case?.attack_prompt || ""}
                    </div>
                  </td>
                  <td className="py-2">
                    <Badge label={r.verdict} kind={VERDICT_KIND[r.verdict] || "error"} />
                  </td>
                  <td className="py-2">
                    <div className="text-xs text-slate-600 truncate max-w-[240px]">
                      {r.model_response || r.error || ""}
                    </div>
                  </td>
                  <td className="py-2 text-xs text-slate-500">
                    {r.latency_ms != null ? r.latency_ms + " ms" : "—"}
                  </td>
                  <td className="py-2 text-xs text-rose-600 truncate max-w-[160px]">
                    {r.error || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
