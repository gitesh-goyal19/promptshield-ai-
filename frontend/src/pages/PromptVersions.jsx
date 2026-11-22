import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../services/api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { TextArea } from "../components/TextArea";

function diffLines(oldText, newText) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const changes = [];
  let i = 0, j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      changes.push({ type: "equal", line: oldLines[i] });
      i++; j++;
    } else if (j < newLines.length && (i >= oldLines.length || oldLines[i] !== newLines[j])) {
      // check if this new line appears later in old (pure add)
      changes.push({ type: "add", line: newLines[j] });
      j++;
    } else {
      changes.push({ type: "remove", line: oldLines[i] });
      i++;
    }
  }
  return changes;
}

export default function PromptVersions() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [versions, setVersions] = useState([]);
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);
  const [newPrompt, setNewPrompt] = useState("");
  const [suggested, setSuggested] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    load();
  }, [projectId]);

  const load = async () => {
    try {
      setLoading(true);
      const [p, vs] = await Promise.all([api.getProject(projectId), getVersions(projectId)]);
      setProject(p);
      setVersions(vs);
    } catch (e) {
      setError(e.message || "Failed to load versions");
    } finally {
      setLoading(false);
    }
  };

  const getVersions = async (id) => {
    const res = await fetch(`/api/projects/${id}/prompts`);
    if (!res.ok) throw new Error("Failed to load versions");
    return res.json();
  };

  const handleSuggest = async () => {
    if (!project || versions.length === 0) return;
    try {
      const latest = versions[versions.length - 1];
      const data = await api.suggestPrompt(project.id, {
        prompt_version_id: latest.id,
        failures: [],
      });
      setSuggested(data);
      setNewPrompt(data.suggested_system_prompt || "");
      setInfo ? null : null;
    } catch (e) {
      setError(e.message || "Suggestion failed");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!project) return;
    if (!newPrompt.trim()) {
      setError("Please enter a system prompt.");
      return;
    }
    setError("");
    try {
      await fetch(`/api/projects/${project.id}/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_prompt: newPrompt }),
      });
      setNewPrompt("");
      load();
    } catch (e) {
      setError(e.message || "Failed to save version");
    }
  };

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <div className="text-rose-700 text-sm">{error}</div>;
  if (!project) return <p className="text-slate-500">Project not found.</p>;

  const diff = (compareA && compareB) ? diffLines(compareA.system_prompt, compareB.system_prompt) : [];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold">Prompt Versions</h1>
        <Link to="/">← Back to dashboard</Link>
      </div>
      <Card className="mb-6">
        <h2 className="font-semibold">{project.name}</h2>
        <p className="text-sm text-slate-500">{project.description || "No description"}</p>
        <p className="text-xs text-slate-400 mt-2">Versions are numbered and never overwritten.</p>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">Save a new version</h3>
        <form onSubmit={handleSave} className="space-y-3">
          <TextArea
            label="System prompt (new version)"
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            rows={6}
            placeholder="Enter the new system prompt text..."
          />
          <div className="flex gap-3">
            <Button onClick={handleSuggest} variant="outline" size="sm">Suggest improvement (judge)</Button>
            <Button type="submit">Save as new version</Button>
          </div>
        </form>
      </Card>

      <div className="mt-6">
        <h3 className="font-semibold mb-3">Version history</h3>
        <div className="space-y-2">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <span className="w-12 text-xs font-mono text-slate-500">v{v.version_no}</span>
              <span className="text-sm">{new Date(v.created_at).toLocaleString()}</span>
              <div className="ml-auto flex gap-2">
                <Button
                  onClick={() => setCompareA(v)}
                  size="sm"
                  variant="outline"
                  active={compareA?.id === v.id}
                >
                  Compare A
                </Button>
                <Button
                  onClick={() => setCompareB(v)}
                  size="sm"
                  variant="outline"
                  active={compareB?.id === v.id}
                >
                  Compare B
                </Button>
              </div>
            </div>
          ))}
          {versions.length === 0 && <p className="text-sm text-slate-500">No versions yet.</p>}
        </div>
      </div>

      {(compareA || compareB) && (
        <div className="mt-8">
          <h3 className="font-semibold mb-3">Diff</h3>
          <p className="text-sm text-slate-500 mb-3">
            {compareA && compareB ? `v${compareA.version_no} → v${compareB.version_no}` : "Select two versions to compare."}
          </p>
          {diff.length > 0 ? (
            <div className="font-mono text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto max-h-[600px] overflow-y-auto">
              {diff.map((c, idx) => {
                const cls = c.type === "add" ? "text-emerald-400 bg-emerald-900/20" : c.type === "remove" ? "text-rose-400 bg-rose-900/20" : "text-slate-300";
                const prefix = c.type === "add" ? "+ " : c.type === "remove" ? "- " : "  ";
                return (
                  <div key={idx} className={`px-2 ${cls}`}>
                    {prefix}{c.line}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No differences.</p>
          )}
        </div>
      )}
    </div>
  );
}
