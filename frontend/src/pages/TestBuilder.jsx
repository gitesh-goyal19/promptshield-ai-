import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { TextArea } from "../components/TextArea";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";

const CATEGORIES = [
  "instruction_override",
  "role_spoofing",
  "conflicting_instructions",
  "untrusted_text_injection",
  "hidden_rule_disclosure",
  "benign_requests",
];

const CATEGORY_LABELS = {
  instruction_override: "Instruction Override",
  role_spoofing: "Role Spoofing",
  conflicting_instructions: "Conflicting Instructions",
  untrusted_text_injection: "Untrusted Text Injection",
  hidden_rule_disclosure: "Hidden Rule Disclosure",
  benign_requests: "Benign Requests",
};

export default function TestBuilder() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [n, setN] = useState(5);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    api.listProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) return;
    api.listTests(projectId).then(setTests).catch(() => {});
  }, [projectId]);

  const handleGenerate = async () => {
    if (!projectId) {
      setError("Select a project first.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.generateTests(projectId, {
        category,
        n: parseInt(n, 10) || 5,
        system_prompt: systemPrompt,
      });
      setInfo(
        `Generated ${res.generated} test(s)${res.fallback_used ? " (fallback templates used)" : ""}.`
      );
      setTests(res.tests);
    } catch (e) {
      setError(e.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id, approved) => {
    try {
      await api.updateTest(id, { approved });
      setTests((ts) => ts.map((t) => (t.id === id ? { ...t, approved } : t)));
    } catch (e) {
      setError(e.message || "Failed to update approval");
    }
  };

  const handleFieldChange = (id, field, value) => {
    setTests((ts) => ts.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const handleSave = async (id) => {
    const t = tests.find((x) => x.id === id);
    if (!t) return;
    try {
      await api.updateTest(id, {
        attack_prompt: t.attack_prompt,
        rule_being_tested: t.rule_being_tested,
        expected_behavior: t.expected_behavior,
        evaluation_criteria: t.evaluation_criteria,
      });
      setInfo("Test saved.");
    } catch (e) {
      setError(e.message || "Save failed");
    }
  };

  if (projects.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Test Builder</h1>
        <p className="text-slate-500">No projects yet. <Link to="/new-project">Create a project</Link> first.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold">Test Builder</h1>
        <Link to="/" className="text-sm text-slate-600 underline">← Dashboard</Link>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Generate safe, synthetic prompt-injection tests for a category. Review, edit, and approve them before running.
      </p>

      <Card className="mb-6">
        <h3 className="font-semibold mb-3">1. Select project</h3>
        <div className="mb-4">
          <label className="label">Project</label>
          <select
            className="input"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setTests([]);
              setInfo("");
            }}
          >
            <option value="">-- choose a project --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.authorization_confirmed ? "" : " (not authorized)"}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Only authorized projects can be used.</p>
        </div>
        <div className="mb-4">
          <label className="label">System prompt (context for generation)</label>
          <TextArea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={4}
            placeholder="Paste the chatbot's system prompt here..."
          />
        </div>
      </Card>

      <Card className="mb-6">
        <h3 className="font-semibold mb-3">2. Generate tests</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="label block mb-1">Category</label>
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c] || c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label block mb-1">Number of tests</label>
            <Input value={String(n)} onChange={(e) => setN(e.target.value)} placeholder="5" />
          </div>
          <div>
            <Button onClick={handleGenerate} disabled={loading || !projectId}>
              {loading ? "Generating…" : "Generate"}
            </Button>
          </div>
          <div>
            <Badge label={info ? "info" : ""} kind="pass" />
          </div>
        </div>
        {info && (
          <div className="mt-3 p-3 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
            {info}
          </div>
        )}
        {error && (
          <div className="mt-3 p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            {error}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">3. Review &amp; approve tests</h3>
        <p className="text-sm text-slate-500 mb-4">
          Unapproved tests are never run. Edit any field, then save. Approve tests you want to include in a run.
        </p>
        {tests.length === 0 ? (
          <p className="text-slate-500">No tests yet. Generate tests above.</p>
        ) : (
          <div className="space-y-3">
            {tests.map((t) => (
              <div key={t.id} className="border border-slate-200 rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-slate-500">{t.test_id}</span>
                  <span className={`text-xs font-semibold ${
                    t.approved ? "text-emerald-700" : "text-slate-500"
                  }`}>
                    {t.approved ? "Approved" : "Not approved"}
                  </span>
                  <Badge
                    label={t.source || "generated"}
                    kind={t.source === "fallback" ? "review" : "pass"}
                  />
                </div>
                <TextArea
                  label="Attack prompt (test message)"
                  value={t.attack_prompt}
                  onChange={(e) => handleFieldChange(t.id, "attack_prompt", e.target.value)}
                  rows={2}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextArea
                    label="Rule being tested"
                    value={t.rule_being_tested}
                    onChange={(e) => handleFieldChange(t.id, "rule_being_tested", e.target.value)}
                    rows={2}
                  />
                  <TextArea
                    label="Expected secure behavior"
                    value={t.expected_behavior}
                    onChange={(e) => handleFieldChange(t.id, "expected_behavior", e.target.value)}
                    rows={2}
                  />
                </div>
                <TextArea
                  label="Evaluation criteria"
                  value={t.evaluation_criteria || ""}
                  onChange={(e) => handleFieldChange(t.id, "evaluation_criteria", e.target.value)}
                  rows={2}
                />
                <div className="flex items-center gap-4 pt-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={t.approved}
                      onChange={(e) => handleApprove(t.id, e.target.checked)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    Approve this test for running
                  </label>
                  <Button
                    onClick={() => handleSave(t.id)}
                    size="sm"
                    variant="outline"
                  >
                    Save changes
                  </Button>
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-500 mt-4">
              Approved test count:{ " "}
              <span className="font-semibold">{tests.filter((t) => t.approved).length}</span>{" "}
              of {tests.length}.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
