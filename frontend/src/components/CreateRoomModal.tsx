'use client';

import { useState } from 'react';
import { useRouter } from '../i18n/navigation';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

interface Project {
  id: string;
  name: string;
  organization: string;
  team: string | null;
  ado_url: string | null;
  created_at: string;
}

interface ParsedUrl {
  organization: string;
  project: string;
  team: string;
  sprint: string;
}

interface Sprint {
  id: string;
  name: string;
  path: string;
  start_date: string | null;
  finish_date: string | null;
}

interface ScoreEntry {
  tempId: string; // client-only key
  title: string;
  description: string;
  story_points: string; // string for input, parse on submit
}

type Step = 'project' | 'pat' | 'sprint' | 'scores';

interface Props {
  initialProjects: Project[];
  locale: string;
  onClose: () => void;
}

export default function CreateRoomModal({ initialProjects, onClose }: Props) {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<Step>('project');

  // Project step state
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjects.length > 0 ? initialProjects[0].id : '',
  );
  const [showUrlInput, setShowUrlInput] = useState(initialProjects.length === 0);
  const [url, setUrl]               = useState('');
  const [parsed, setParsed]         = useState<ParsedUrl | null>(null);
  const [parsing, setParsing]       = useState(false);
  const [parseError, setParseError] = useState('');
  const [savedProject, setSavedProject] = useState<Project | null>(null);

  // Sprint step state
  const [sprints, setSprints]               = useState<Sprint[]>([]);
  const [loadingSprints, setLoadingSprints] = useState(false);
  const [sprintError, setSprintError]       = useState('');
  const [selectedSprintId, setSelectedSprintId] = useState('');

  // PAT step state
  const [pat, setPat]           = useState('');
  const [patError, setPatError] = useState('');
  const [savingPat, setSavingPat] = useState(false);

  // Scores step state
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [savingScores, setSavingScores] = useState(false);
  const [scoresError, setScoresError] = useState('');

  // Create state
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState('');

  // ── Shared sprint fetcher ──────────────────────────────────────────────

  async function fetchSprints(projectId: string): Promise<boolean> {
    setLoadingSprints(true);
    setSprintError('');
    try {
      const res = await fetch(`${BACKEND}/api/projects/${projectId}/sprints`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'ADO_AUTH_REQUIRED') {
          setPatError('');
          setStep('pat');
          return false;
        }
        setSprintError(data.error ?? 'Failed to load sprints.');
        return false;
      }
      setSprints(data as Sprint[]);
      if (data.length > 0) setSelectedSprintId(data[0].id);
      setStep('sprint');
      return true;
    } catch {
      setSprintError('Network error loading sprints.');
      return false;
    } finally {
      setLoadingSprints(false);
    }
  }

  // Fetch existing reference scores for a project and pre-populate
  async function fetchReferenceScores(projectId: string) {
    try {
      const res = await fetch(`${BACKEND}/api/projects/${projectId}/reference-scores`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json() as Array<{ id: string; title: string; description: string | null; story_points: number }>;
      setScores(
        data.map(s => ({
          tempId: s.id,
          title: s.title,
          description: s.description ?? '',
          story_points: String(s.story_points),
        })),
      );
    } catch {
      // Ignore — just start with empty list
    }
  }

  // ── Project step ──────────────────────────────────────────────────────────

  async function handleParseUrl() {
    if (!url.trim()) return;
    setParsing(true);
    setParseError('');
    setParsed(null);

    try {
      const res = await fetch(`${BACKEND}/api/projects/parse-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setParseError(data.error ?? 'Could not parse URL.');
      } else {
        setParsed(data as ParsedUrl);
      }
    } catch {
      setParseError('Network error. Please try again.');
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirmProject() {
    let projectId: string;
    let project: Project;

    if (!showUrlInput && selectedProjectId) {
      projectId = selectedProjectId;
      project = initialProjects.find(p => p.id === selectedProjectId)!;
      setSavedProject(project);
    } else {
      if (!parsed) return;
      try {
        const res = await fetch(`${BACKEND}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: parsed.project,
            organization: parsed.organization,
            team: parsed.team,
            adoUrl: url.trim(),
          }),
        });
        if (!res.ok) throw new Error();
        project = await res.json() as Project;
        setSavedProject(project);
        projectId = project.id;
      } catch {
        setParseError('Failed to save project. Please try again.');
        return;
      }
    }

    // Pre-load existing reference scores
    await fetchReferenceScores(projectId);

    // Fetch sprints
    setStep('sprint');
    await fetchSprints(projectId);
  }

  // ── PAT step ──────────────────────────────────────────────────────────────

  async function handleSavePat() {
    if (!pat.trim() || !savedProject) return;
    setSavingPat(true);
    setPatError('');
    try {
      const res = await fetch(`${BACKEND}/api/projects/${savedProject.id}/pat`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pat: pat.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        setPatError(d.error ?? 'Failed to save PAT.');
        return;
      }
      await fetchSprints(savedProject.id);
    } catch {
      setPatError('Network error. Please try again.');
    } finally {
      setSavingPat(false);
    }
  }

  // ── Sprint step ───────────────────────────────────────────────────────────

  function handleGoToScores() {
    setStep('scores');
  }

  // ── Scores step ───────────────────────────────────────────────────────────

  function addScoreEntry() {
    setScores(prev => [
      ...prev,
      { tempId: Math.random().toString(36).slice(2), title: '', description: '', story_points: '' },
    ]);
  }

  function removeScoreEntry(tempId: string) {
    setScores(prev => prev.filter(s => s.tempId !== tempId));
  }

  function updateScoreEntry(tempId: string, field: keyof Omit<ScoreEntry, 'tempId'>, value: string) {
    setScores(prev => prev.map(s => s.tempId === tempId ? { ...s, [field]: value } : s));
  }

  async function handleCreateRoom() {
    if (!selectedSprintId || !savedProject) return;
    setCreating(true);
    setSavingScores(true);
    setCreateError('');
    setScoresError('');

    // Validate and save scores if any
    const validScores = scores.filter(s => s.title.trim() && s.story_points.trim());
    const invalidScore = scores.find(s => (s.title.trim() || s.story_points.trim()) && (!s.title.trim() || !s.story_points.trim() || isNaN(Number(s.story_points))));

    if (invalidScore) {
      setScoresError('Each score entry needs a title and a valid numeric story point value.');
      setCreating(false);
      setSavingScores(false);
      return;
    }

    try {
      // Save reference scores (even if empty — clears old ones)
      await fetch(`${BACKEND}/api/projects/${savedProject.id}/reference-scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          validScores.map(s => ({
            title: s.title.trim(),
            description: s.description.trim() || undefined,
            story_points: Number(s.story_points),
          })),
        ),
      });
    } catch {
      // Non-fatal: continue to room creation
    } finally {
      setSavingScores(false);
    }

    try {
      const res = await fetch(`${BACKEND}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId: savedProject.id, sprintId: selectedSprintId }),
      });
      const data = await res.json() as { code: string; error?: string };
      if (!res.ok) {
        setCreateError(data.error ?? 'Failed to create room.');
        return;
      }
      router.push(`/room/${data.code}`);
    } catch {
      setCreateError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const stepLabel =
    step === 'project' ? 'Step 1 of 3'
    : step === 'pat' ? 'Step 2 of 3'
    : step === 'sprint' ? 'Step 2 of 3'
    : 'Step 3 of 3';

  const stepTitle =
    step === 'project' ? 'Connect Azure DevOps'
    : step === 'pat' ? 'Azure DevOps Access'
    : step === 'sprint' ? 'Select Sprint'
    : 'Reference Story Points';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
          <div>
            <p className="text-xs text-cyan-600 dark:text-indigo-400 font-medium uppercase tracking-wider mb-0.5">
              {stepLabel}
            </p>
            <h2 className="text-gray-900 dark:text-white font-semibold text-lg">{stepTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* ── PROJECT STEP ── */}
          {step === 'project' && (
            <>
              {initialProjects.length > 0 && !showUrlInput && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">Your saved projects</p>
                  {initialProjects.map(p => (
                    <label
                      key={p.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedProjectId === p.id
                          ? 'border-cyan-500 bg-cyan-600/10 dark:border-indigo-500 dark:bg-indigo-600/10'
                          : 'border-gray-200 hover:border-gray-300 dark:border-slate-700 dark:hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="project"
                        value={p.id}
                        checked={selectedProjectId === p.id}
                        onChange={() => setSelectedProjectId(p.id)}
                        className="mt-0.5 accent-cyan-500 dark:accent-indigo-500"
                      />
                      <div>
                        <p className="text-gray-900 dark:text-white text-sm font-medium">{p.name}</p>
                        <p className="text-gray-500 dark:text-slate-500 text-xs">{p.organization}{p.team ? ` · ${p.team}` : ''}</p>
                      </div>
                    </label>
                  ))}

                  <button
                    onClick={() => { setShowUrlInput(true); setParsed(null); setParseError(''); }}
                    className="text-cyan-600 hover:text-cyan-500 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium transition-colors"
                  >
                    + Connect a new project
                  </button>
                </div>
              )}

              {showUrlInput && (
                <div className="space-y-3">
                  {initialProjects.length > 0 && (
                    <button
                      onClick={() => { setShowUrlInput(false); setParsed(null); setParseError(''); }}
                      className="text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white text-sm transition-colors flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to saved projects
                    </button>
                  )}

                  <div>
                    <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">
                      Azure DevOps sprint board URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={url}
                        onChange={e => { setUrl(e.target.value); setParsed(null); setParseError(''); }}
                        placeholder="https://dev.azure.com/org/project/_sprints/backlog/Team/.../Sprint"
                        className="flex-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500"
                      />
                      <button
                        onClick={handleParseUrl}
                        disabled={parsing || !url.trim()}
                        className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      >
                        {parsing ? 'Parsing…' : 'Parse URL'}
                      </button>
                    </div>
                  </div>

                  {parseError && <p className="text-red-500 dark:text-red-400 text-sm">{parseError}</p>}

                  {parsed && (
                    <div className="bg-gray-50 border border-gray-200 dark:bg-slate-800/60 dark:border-slate-700 rounded-xl p-4 space-y-2">
                      <p className="text-cyan-600 dark:text-indigo-400 text-xs font-medium uppercase tracking-wider">Parsed successfully</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                        <span className="text-gray-500 dark:text-slate-500">Organization</span>
                        <span className="text-gray-900 dark:text-white font-medium">{parsed.organization}</span>
                        <span className="text-gray-500 dark:text-slate-500">Project</span>
                        <span className="text-gray-900 dark:text-white font-medium">{parsed.project}</span>
                        <span className="text-gray-500 dark:text-slate-500">Team</span>
                        <span className="text-gray-900 dark:text-white font-medium">{parsed.team}</span>
                        <span className="text-gray-500 dark:text-slate-500">Sprint</span>
                        <span className="text-gray-900 dark:text-white font-medium">{parsed.sprint}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── PAT STEP ── */}
          {step === 'pat' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30 rounded-xl p-4">
                <p className="text-amber-600 dark:text-amber-400 text-sm font-medium mb-1">⚠️ Azure DevOps access required</p>
                <p className="text-gray-600 dark:text-slate-400 text-sm">
                  Your account doesn&apos;t have direct Azure DevOps API access. Enter a Personal Access Token (PAT)
                  with <span className="text-gray-900 dark:text-white font-medium">Work Items (Read)</span> scope to continue.
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Personal Access Token</label>
                <input
                  type="password"
                  value={pat}
                  onChange={e => { setPat(e.target.value); setPatError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleSavePat()}
                  placeholder="Paste your PAT here"
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500"
                />
                <p className="text-gray-500 dark:text-slate-500 text-xs mt-1.5">
                  Generate a PAT at{' '}
                  <a href="https://dev.azure.com/_usersSettings/tokens" target="_blank" rel="noreferrer" className="text-cyan-600 hover:text-cyan-500 dark:text-indigo-400 dark:hover:text-indigo-300 underline">
                    dev.azure.com/_usersSettings/tokens
                  </a>
                  {' '}— enable <span className="text-gray-700 dark:text-slate-300">Work Items (Read)</span> scope.
                </p>
              </div>
              {patError && <p className="text-red-500 dark:text-red-400 text-sm">{patError}</p>}
            </div>
          )}

          {/* ── SPRINT STEP ── */}
          {step === 'sprint' && (
            <div className="space-y-3">
              {loadingSprints && (
                <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400 text-sm">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Loading sprints…
                </div>
              )}

              {sprintError && <p className="text-red-500 dark:text-red-400 text-sm">{sprintError}</p>}

              {!loadingSprints && sprints.length > 0 && (
                <>
                  <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">Select a sprint</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {sprints.map(s => (
                      <label
                        key={s.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          selectedSprintId === s.id
                            ? 'border-cyan-500 bg-cyan-600/10 dark:border-indigo-500 dark:bg-indigo-600/10'
                            : 'border-gray-200 hover:border-gray-300 dark:border-slate-700 dark:hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="sprint"
                          value={s.id}
                          checked={selectedSprintId === s.id}
                          onChange={() => setSelectedSprintId(s.id)}
                          className="mt-0.5 accent-cyan-500 dark:accent-indigo-500"
                        />
                        <div>
                          <p className="text-gray-900 dark:text-white text-sm font-medium">{s.name}</p>
                          {(s.start_date || s.finish_date) && (
                            <p className="text-gray-500 dark:text-slate-500 text-xs mt-0.5">
                              {s.start_date ? s.start_date.slice(0, 10) : '?'}
                              {' → '}
                              {s.finish_date ? s.finish_date.slice(0, 10) : '?'}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── SCORES STEP ── */}
          {step === 'scores' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-800 dark:text-slate-300 font-medium mb-1">Reference story point examples</p>
                <p className="text-xs text-gray-500 dark:text-slate-500">
                  Add example work items with known story points to help your team calibrate estimates.
                  These are saved per project and pre-filled next time.
                </p>
              </div>

              {scores.length > 0 && (
                <div className="space-y-3">
                  {scores.map((score) => (
                    <div key={score.tempId} className="bg-gray-50 border border-gray-200 dark:bg-slate-800/50 dark:border-slate-700 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={score.title}
                          onChange={e => updateScoreEntry(score.tempId, 'title', e.target.value)}
                          placeholder="Work item title (e.g. Add login button)"
                          className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500"
                        />
                        <input
                          type="number"
                          value={score.story_points}
                          onChange={e => updateScoreEntry(score.tempId, 'story_points', e.target.value)}
                          placeholder="SP"
                          min="0"
                          step="0.5"
                          className="w-20 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500 text-center"
                        />
                        <button
                          onClick={() => removeScoreEntry(score.tempId)}
                          className="text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors p-1 rounded"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={score.description}
                        onChange={e => updateScoreEntry(score.tempId, 'description', e.target.value)}
                        placeholder="Optional description"
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={addScoreEntry}
                className="w-full py-2 rounded-xl border border-dashed border-gray-300 hover:border-cyan-500 text-gray-500 hover:text-cyan-600 dark:border-slate-700 dark:hover:border-indigo-500 dark:text-slate-400 dark:hover:text-indigo-300 text-sm font-medium transition-colors"
              >
                + Add reference item
              </button>

              {scoresError && <p className="text-red-500 dark:text-red-400 text-sm">{scoresError}</p>}
              {createError && <p className="text-red-500 dark:text-red-400 text-sm">{createError}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3">
          {step === 'project' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-400 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white dark:hover:border-slate-600 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmProject}
                disabled={showUrlInput ? !parsed : !selectedProjectId}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Confirm & Select Sprint
              </button>
            </>
          ) : step === 'pat' ? (
            <>
              <button
                onClick={() => { setStep('project'); setPatError(''); setPat(''); }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-400 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white dark:hover:border-slate-600 text-sm transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSavePat}
                disabled={savingPat || !pat.trim()}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingPat ? 'Saving…' : 'Save & Load Sprints'}
              </button>
            </>
          ) : step === 'sprint' ? (
            <>
              <button
                onClick={() => { setStep('project'); setSprintError(''); }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-400 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white dark:hover:border-slate-600 text-sm transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleGoToScores}
                disabled={!selectedSprintId || loadingSprints}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next: Reference Points
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep('sprint'); setScoresError(''); setCreateError(''); }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-400 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white dark:hover:border-slate-600 text-sm transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreateRoom}
                disabled={creating || savingScores}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating || savingScores ? 'Creating…' : 'Save & Create Room'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
