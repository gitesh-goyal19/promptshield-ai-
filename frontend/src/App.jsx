import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "./services/api";
import Playground from "./pages/Playground";
import PromptVersions from "./pages/PromptVersions";
import DemoMode from "./pages/DemoMode";
import TestBuilder from "./pages/TestBuilder";
import TestRunner from "./pages/TestRunner";
import Results from "./pages/Results";
import Comparison from "./pages/Comparison";

function Nav() {
  const location = useLocation();
  const nav = [
    { to: "/", label: "Dashboard" },
    { to: "/new-project", label: "New Project" },
    { to: "/playground", label: "Playground" },
    { to: "/demo", label: "Demo Mode" },
    { to: "/test-builder", label: "Test Builder" },
    { to: "/test-runner", label: "Test Runner" },
    { to: "/comparison", label: "Comparison" },
    { to: "/settings", label: "Settings" },
  ];
  return (
    <nav className="bg-slate-900 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight">PromptShield AI</span>
            <span className="ml-2 text-xs bg-emerald-900 text-emerald-200 px-2 py-1 rounded">DEFENSIVE</span>
          </div>
          <div className="hidden md:flex items-center space-x-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                  location.pathname === item.to
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800/50"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <a href="/docs" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-white underline">Docs</a>
          </div>
        </div>
        <div className="border-t border-slate-800/50">
          <p className="mx-4 px-3 py-2 text-xs text-slate-400">
            Defensive testing tool for chatbots you own or are authorized to test.{" "}
            <span className="font-semibold text-slate-300">Never test third-party systems without permission.</span>
          </p>
        </div>
      </div>
    </nav>
  );
}

function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.listProjects();
      setProjects(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      {error && (
        <div className="mb-4 p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-slate-500">Loading projects...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.length === 0 ? (
            <p className="text-slate-500 col-span-full">No projects yet. Create your first project to get started.</p>
          ) : (
            projects.map((p) => (
              <div key={p.id} className="card">
                <h2 className="text-lg font-semibold">{p.name}</h2>
                <p className="text-sm text-slate-500 mb-4">{p.description || "No description"}</p>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-medium ${p.authorization_confirmed ? "text-emerald-700" : "text-rose-700"}`}>
                    {p.authorization_confirmed ? "Authorization confirmed" : "Authorization not confirmed"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Link to={`/projects/${p.id}/versions`} className="btn btn-outline text-xs px-3 py-1.5">
                    View versions
                  </Link>
                </div>
              </div>
            ))
          )}
          <Link to="/new-project" className="col-span-full md:col-span-auto btn">
            + Create Project
          </Link>
        </div>
      )}
    </div>
  );
}

function NewProject() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!authorized) {
      setError("You must confirm authorization to create a project.");
      return;
    }
    try {
      setSubmitting(true);
      await api.createProject({ name, description, authorization_confirmed: true });
      navigate("/");
    } catch (e) {
      setError(e.message || "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold mb-6">New Project</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Project name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. University Helpdesk Bot"
            required
          />
          <p className="mt-1 text-xs text-slate-500">A name for this chatbot testing project.</p>
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <textarea
            className="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What does this chatbot do?"
          />
        </div>
        <div className="flex items-start gap-3">
          <input
            id="authorization"
            type="checkbox"
            className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
            required
          />
          <label htmlFor="authorization" className="text-sm leading-6">
            <span className="font-semibold">I own this chatbot or have permission to test it.</span>
            <br />
            <span className="text-slate-500">Creating a project requires this confirmation.</span>
          </label>
        </div>
        {error && (
          <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-sm">{error}</div>
        )}
        <div className="flex items-center gap-3 pt-4">
          <button type="submit" className="btn" disabled={submitting || !authorized}>
            {submitting ? "Creating..." : "Create Project"}
          </button>
          <Link to="/" className="btn-outline text-xs px-3 py-1.5">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function PlaceholderPage({ title, subtitle }) {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-slate-500 mb-8">{subtitle}</p>
      <div className="card border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
        <p className="text-slate-500">Coming soon in the next milestone.</p>
      </div>
    </div>
  );
}

function Settings() {
  return <PlaceholderPage title="Settings" subtitle="Backend health and model configuration." />;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Nav />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new-project" element={<NewProject />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/projects/:projectId/versions" element={<PromptVersions />} />
          <Route path="/test-builder" element={<TestBuilder />} />
          <Route path="/test-runner" element={<TestRunner />} />
          <Route path="/runs/:runId/results" element={<Results />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/demo" element={<DemoMode />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
