import { useState, useEffect } from "react";
import { api } from "../services/api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { TextArea } from "../components/TextArea";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";

export default function Playground() {
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const [keyPresent, setKeyPresent] = useState(false);

  useEffect(() => {
    api.listPresets().then(setPresets).catch(() => {});
    api.getModels().then((m) => {
      setModel(m.target_model);
      setKeyPresent(m.api_key_present);
    }).catch(() => {});
  }, []);

  const handlePresetSelect = (id) => {
    const p = presets.find((x) => x.id === id);
    if (p) {
      setSelectedPreset(id);
      setSystemPrompt(p.system_prompt);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError("");
    setReply("");
    if (!keyPresent) {
      setError("Gemini API key is not configured on the backend. Set GEMINI_API_KEY in .env.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.chat({ system_prompt: systemPrompt, message, model, settings: { temperature: 0.7 } });
      setReply(res.reply || "");
      if (res.error) setError(res.error);
      if (res.blocked) setError("Response was blocked by the provider safety filter.");
    } catch (e) {
      setError(e.message || "Chat failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold">Playground</h1>
        <Badge label={keyPresent ? "Backend key present" : "No backend key"} kind={keyPresent ? "pass" : "error"} />
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Chat with the target model using your system prompt. All model calls happen on the backend; the API key never reaches the browser.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <h3 className="font-semibold mb-3">System prompt</h3>
            <p className="text-xs text-slate-500 mb-3">The rules given to the model.</p>
            <div className="flex gap-2 mb-3">
              {presets.map((p) => (
                <Button
                  key={p.id}
                  onClick={() => handlePresetSelect(p.id)}
                  active={selectedPreset === p.id}
                  size="sm"
                >
                  {p.title}
                </Button>
              ))}
              <Button onClick={() => { setSelectedPreset(""); }} active={selectedPreset === ""} size="sm" variant="outline">
                Custom
              </Button>
            </div>
            <TextArea
              label="System prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={8}
              placeholder="Paste your system prompt here..."
            />
            <p className="text-xs text-slate-500">Tip: A system prompt sets the model's role and rules.</p>
          </Card>
          {!keyPresent && (
            <Card className="border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">No API key configured. Playground calls will return a clear error instead of crashing.</p>
            </Card>
          )}
        </div>
        <div className="lg:col-span-8">
          <Card>
            <h3 className="font-semibold mb-3">Chat</h3>
            <form onSubmit={handleSend} className="space-y-3">
              <TextArea
                label="Your message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Type a message..."
                disabled={loading}
              />
              <Button type="submit" disabled={loading || !message.trim()} loading={loading}>
                {loading ? "Sending…" : "Send"}
              </Button>
            </form>
            {error && (
              <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-sm mb-4">
                {error}
              </div>
            )}
            {reply && (
              <div className="border border-slate-200 rounded-lg bg-slate-50 p-4 max-h-[400px] overflow-y-auto text-sm break-words">
                <p className="text-slate-700">{reply}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
