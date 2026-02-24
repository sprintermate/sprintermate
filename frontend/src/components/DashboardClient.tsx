'use client';

import { useState } from 'react';
import CreateRoomModal from './CreateRoomModal';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

interface UserSession {
  id: string;
  displayName: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
  organization: string;
  team: string | null;
  ado_url: string | null;
  hasPat?: boolean;
  created_at: string;
}

interface ScoreEntry {
  tempId: string;
  title: string;
  description: string;
  story_points: string;
}

interface Room {
  id: string;
  code: string;
  status: string;
  created_at: string;
  project_name: string;
  organization: string;
  sprint_name: string;
}

interface Props {
  user: UserSession;
  initialProjects: Project[];
  initialRooms: Room[];
  locale: string;
}

type ActiveTab = 'rooms' | 'projects';

export default function DashboardClient({ initialProjects, initialRooms, locale }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('rooms');
  const [modalOpen, setModalOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

  // Projects state
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{ name: string; organization: string; team: string; adoUrl: string }>({
    name: '', organization: '', team: '', adoUrl: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Reference scores state (for the currently open edit form)
  const [editScores, setEditScores] = useState<ScoreEntry[]>([]);
  const [scoresLoading, setScoresLoading] = useState(false);

  async function startEdit(project: Project) {
    setEditingId(project.id);
    setEditFields({
      name: project.name,
      organization: project.organization,
      team: project.team ?? '',
      adoUrl: project.ado_url ?? '',
    });
    setEditError('');
    setEditScores([]);

    // Load existing reference scores
    setScoresLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/projects/${project.id}/reference-scores`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json() as Array<{ id: string; title: string; description: string | null; story_points: number }>;
        setEditScores(data.map(s => ({
          tempId: s.id,
          title: s.title,
          description: s.description ?? '',
          story_points: String(s.story_points),
        })));
      }
    } catch {
      // ignore — user can still add scores manually
    } finally {
      setScoresLoading(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditScores([]);
    setEditError('');
  }

  function addScoreEntry() {
    setEditScores(prev => [
      ...prev,
      { tempId: Math.random().toString(36).slice(2), title: '', description: '', story_points: '' },
    ]);
  }

  function removeScoreEntry(tempId: string) {
    setEditScores(prev => prev.filter(s => s.tempId !== tempId));
  }

  function updateScoreEntry(tempId: string, field: keyof Omit<ScoreEntry, 'tempId'>, value: string) {
    setEditScores(prev => prev.map(s => s.tempId === tempId ? { ...s, [field]: value } : s));
  }

  async function saveEdit(projectId: string) {
    // Validate scores
    const invalidScore = editScores.find(
      s => (s.title.trim() || s.story_points.trim()) &&
           (!s.title.trim() || !s.story_points.trim() || isNaN(Number(s.story_points))),
    );
    if (invalidScore) {
      setEditError('Each reference score needs a title and a valid numeric story point value.');
      return;
    }

    setSavingEdit(true);
    setEditError('');
    try {
      // Save project fields
      const res = await fetch(`${BACKEND}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editFields.name.trim(),
          organization: editFields.organization.trim(),
          team: editFields.team.trim() || undefined,
          adoUrl: editFields.adoUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? 'Failed to update project.');
        return;
      }

      // Save reference scores
      const validScores = editScores.filter(s => s.title.trim() && s.story_points.trim());
      await fetch(`${BACKEND}/api/projects/${projectId}/reference-scores`, {
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

      setProjects(prev => prev.map(p => p.id === projectId ? data : p));
      setEditingId(null);
      setEditScores([]);
    } catch {
      setEditError('Network error. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteRoom(roomId: string) {
    if (!confirm('Delete this room? This action cannot be undone.')) return;
    setDeletingRoomId(roomId);
    try {
      const res = await fetch(`${BACKEND}/api/rooms/${roomId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        alert('Failed to delete room.');
        return;
      }
      setRooms(prev => prev.filter(r => r.id !== roomId));
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setDeletingRoomId(null);
    }
  }

  async function handleDelete(projectId: string) {
    if (!confirm('Delete this project? This will also remove all associated sprints, rooms and reference scores.')) return;
    setDeletingId(projectId);
    try {
      const res = await fetch(`${BACKEND}/api/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        alert('Failed to delete project.');
        return;
      }
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  const inputClass = 'w-full bg-gray-100 border border-gray-300 dark:bg-slate-800 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-indigo-500';
  const inputClassWithPlaceholder = 'w-full bg-gray-100 border border-gray-300 dark:bg-slate-800 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 dark:focus:border-indigo-500';

  return (
    <>
      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('rooms')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'rooms'
              ? 'border-cyan-500 text-cyan-600 dark:border-indigo-500 dark:text-indigo-300'
              : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
          }`}
        >
          Rooms
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'projects'
              ? 'border-cyan-500 text-cyan-600 dark:border-indigo-500 dark:text-indigo-300'
              : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
          }`}
        >
          Projects
        </button>
      </div>

      {/* ── ROOMS TAB ── */}
      {activeTab === 'rooms' && (
        <section>
          <div className="flex flex-wrap gap-3 mb-8">
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              + Create Room
            </button>
            <button
              disabled
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-400 dark:text-slate-400 text-sm font-medium cursor-not-allowed opacity-60"
            >
              Join by Code
            </button>
          </div>

          {rooms.length === 0 ? (
            <div className="border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-gray-400 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-gray-400 dark:text-slate-500 text-sm">No rooms yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map(room => (
                <div
                  key={room.id}
                  className="relative p-4 rounded-xl border border-gray-200 hover:border-gray-300 bg-white/50 hover:bg-white dark:border-slate-800 dark:hover:border-slate-700 dark:bg-slate-900/50 dark:hover:bg-slate-900 transition-colors group"
                >
                  <a href={`/${locale}/room/${room.code}`} className="block">
                    <div className="flex items-center justify-between mb-3 pr-7">
                      <span className="font-mono text-lg font-bold text-cyan-600 dark:text-indigo-400 tracking-widest">
                        {room.code}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        room.status === 'waiting'
                          ? 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
                          : room.status === 'voting'
                          ? 'bg-cyan-100/50 text-cyan-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                          : 'bg-green-100/50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {room.status}
                      </span>
                    </div>
                    <p className="text-gray-900 dark:text-white text-sm font-medium truncate">{room.project_name}</p>
                    <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5 truncate">{room.sprint_name}</p>
                    <p className="text-gray-300 dark:text-slate-600 text-xs mt-2">
                      {new Date(room.created_at).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')}
                    </p>
                  </a>

                  {/* Delete button — outside the <a> to avoid navigation */}
                  <button
                    onClick={() => handleDeleteRoom(room.id)}
                    disabled={deletingRoomId === room.id}
                    title="Delete room"
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-slate-600 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    {deletingRoomId === room.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── PROJECTS TAB ── */}
      {activeTab === 'projects' && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Your Projects</h2>

          {projects.length === 0 ? (
            <div className="border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <p className="text-gray-400 dark:text-slate-500 text-sm">
                No projects yet. Create a room to connect an Azure DevOps project.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map(project => (
                <div
                  key={project.id}
                  className="border border-gray-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-900/50 overflow-hidden"
                >
                  {editingId === project.id ? (
                    /* ── Edit form ── */
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-slate-500 mb-1">Project name</label>
                          <input
                            type="text"
                            value={editFields.name}
                            onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-slate-500 mb-1">Organization</label>
                          <input
                            type="text"
                            value={editFields.organization}
                            onChange={e => setEditFields(f => ({ ...f, organization: e.target.value }))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-slate-500 mb-1">Team</label>
                          <input
                            type="text"
                            value={editFields.team}
                            onChange={e => setEditFields(f => ({ ...f, team: e.target.value }))}
                            placeholder="optional"
                            className={inputClassWithPlaceholder}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-slate-500 mb-1">ADO URL</label>
                          <input
                            type="url"
                            value={editFields.adoUrl}
                            onChange={e => setEditFields(f => ({ ...f, adoUrl: e.target.value }))}
                            placeholder="optional"
                            className={inputClassWithPlaceholder}
                          />
                        </div>
                      </div>

                      {/* Reference scores */}
                      <div className="border-t border-gray-200 dark:border-slate-800 pt-4 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-gray-600 dark:text-slate-400">Reference story point examples</p>
                          <p className="text-xs text-gray-400 dark:text-slate-600 mt-0.5">Example work items with known story points to help the team calibrate estimates.</p>
                        </div>

                        {scoresLoading ? (
                          <p className="text-xs text-gray-400 dark:text-slate-500">Loading…</p>
                        ) : (
                          <>
                            {editScores.length > 0 && (
                              <div className="space-y-2">
                                {editScores.map(score => (
                                  <div key={score.tempId} className="bg-gray-100/60 border border-gray-200 dark:bg-slate-800/60 dark:border-slate-700 rounded-lg p-2.5 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={score.title}
                                        onChange={e => updateScoreEntry(score.tempId, 'title', e.target.value)}
                                        placeholder="Work item title"
                                        className="flex-1 bg-white border border-gray-300 dark:bg-slate-800 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 dark:focus:border-indigo-500"
                                      />
                                      <input
                                        type="number"
                                        value={score.story_points}
                                        onChange={e => updateScoreEntry(score.tempId, 'story_points', e.target.value)}
                                        placeholder="SP"
                                        min="0"
                                        step="0.5"
                                        className="w-16 bg-white border border-gray-300 dark:bg-slate-800 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 dark:focus:border-indigo-500 text-center"
                                      />
                                      <button
                                        onClick={() => removeScoreEntry(score.tempId)}
                                        className="text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors"
                                        title="Remove"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                    <input
                                      type="text"
                                      value={score.description}
                                      onChange={e => updateScoreEntry(score.tempId, 'description', e.target.value)}
                                      placeholder="Optional description"
                                      className="w-full bg-white border border-gray-300 dark:bg-slate-800 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 dark:focus:border-indigo-500"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={addScoreEntry}
                              className="w-full py-1.5 rounded-lg border border-dashed border-gray-300 hover:border-cyan-500 text-gray-400 hover:text-cyan-600 dark:border-slate-700 dark:hover:border-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 text-xs font-medium transition-colors"
                            >
                              + Add reference item
                            </button>
                          </>
                        )}
                      </div>

                      {editError && <p className="text-red-500 dark:text-red-400 text-xs">{editError}</p>}
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white text-sm transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(project.id)}
                          disabled={savingEdit || !editFields.name.trim() || !editFields.organization.trim()}
                          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                        >
                          {savingEdit ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Display row ── */
                    <div className="flex items-center justify-between p-4">
                      <div className="min-w-0">
                        <p className="text-gray-900 dark:text-white text-sm font-medium truncate">{project.name}</p>
                        <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5 truncate">
                          {project.organization}
                          {project.team ? ` · ${project.team}` : ''}
                          {project.hasPat ? ' · PAT configured' : ''}
                        </p>
                        <p className="text-gray-300 dark:text-slate-600 text-xs mt-1">
                          Added {new Date(project.created_at).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        <button
                          onClick={() => startEdit(project)}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-900 dark:border-slate-700 dark:hover:border-slate-600 dark:text-slate-400 dark:hover:text-white text-xs font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          disabled={deletingId === project.id}
                          className="px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-400 text-red-500 hover:text-red-600 dark:border-red-900/50 dark:hover:border-red-700 dark:text-red-500 dark:hover:text-red-400 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {deletingId === project.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Modal */}
      {modalOpen && (
        <CreateRoomModal
          initialProjects={projects}
          locale={locale}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
