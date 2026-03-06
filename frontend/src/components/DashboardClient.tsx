'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import CreateRoomModal from './CreateRoomModal';
import CreateRetroModal from './CreateRetroModal';

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

type ActiveTab = 'rooms' | 'projects' | 'retros';

interface RetroSessionSummary {
  id: string;
  code: string;
  title: string;
  status: string;
  theme: string;
  duration_minutes: number;
  created_at: string;
}

export default function DashboardClient({ initialProjects, initialRooms, locale }: Props) {
  const t = useTranslations('dashboard');
  const rt = useTranslations('retro');
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('rooms');
  const [modalOpen, setModalOpen] = useState(false);
  const [retroModalOpen, setRetroModalOpen] = useState(false);
  const [joinRetroModalOpen, setJoinRetroModalOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

  // Retros state
  const [retros, setRetros] = useState<RetroSessionSummary[]>([]);
  const [retrosLoading, setRetrosLoading] = useState(false);
  const [deletingRetroCode, setDeletingRetroCode] = useState<string | null>(null);

  // Join retro popup state
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const loadRetros = useCallback(async () => {
    setRetrosLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/retro`, { credentials: 'include' });
      if (res.ok) setRetros(await res.json());
    } finally {
      setRetrosLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'retros' && retros.length === 0) loadRetros();
  }, [activeTab, retros.length, loadRetros]);

  const handleJoinRetro = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`${BACKEND}/api/retro/${code}`, { credentials: 'include' });
      if (!res.ok) { setJoinError(rt('errorNotFound')); return; }
      router.push(`/${locale}/retro/${code}`);
    } catch {
      setJoinError(rt('errorJoin'));
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteRetro = async (code: string) => {
    if (!confirm(rt('confirmDeleteRetro'))) return;
    setDeletingRetroCode(code);
    try {
      const res = await fetch(`${BACKEND}/api/retro/${code}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) { alert(rt('errorDeleteRetro')); return; }
      setRetros(prev => prev.filter(r => r.code !== code));
    } catch {
      alert(t('errorNetwork'));
    } finally {
      setDeletingRetroCode(null);
    }
  };

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
      setEditError(t('validationError'));
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
        setEditError(data.error ?? t('errorUpdateProject'));
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
      setEditError(t('errorNetwork'));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteRoom(roomId: string) {
    if (!confirm(t('confirmDeleteRoom'))) return;
    setDeletingRoomId(roomId);
    try {
      const res = await fetch(`${BACKEND}/api/rooms/${roomId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        alert(t('errorDeleteRoom'));
        return;
      }
      setRooms(prev => prev.filter(r => r.id !== roomId));
    } catch {
      alert(t('errorNetwork'));
    } finally {
      setDeletingRoomId(null);
    }
  }

  async function handleDelete(projectId: string) {
    if (!confirm(t('confirmDeleteProject'))) return;
    setDeletingId(projectId);
    try {
      const res = await fetch(`${BACKEND}/api/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        alert(t('errorDeleteProject'));
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
          {t('tabRooms')}
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'projects'
              ? 'border-cyan-500 text-cyan-600 dark:border-indigo-500 dark:text-indigo-300'
              : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
          }`}
        >
          {t('tabProjects')}
        </button>
        <button
          onClick={() => setActiveTab('retros')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'retros'
              ? 'border-cyan-500 text-cyan-600 dark:border-indigo-500 dark:text-indigo-300'
              : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
          }`}
        >
          {rt('tabRetro')}
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
              {t('createRoom')}
            </button>
            <button
              disabled
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-400 dark:text-slate-400 text-sm font-medium cursor-not-allowed opacity-60"
            >
              {t('joinByCode')}
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
              <p className="text-gray-400 dark:text-slate-500 text-sm">{t('noRooms')}</p>
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
                    title={t('deleteRoom')}
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t('yourProjects')}</h2>

          {projects.length === 0 ? (
            <div className="border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <p className="text-gray-400 dark:text-slate-500 text-sm">
                {t('noProjects')}
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
                          <label className="block text-xs text-gray-500 dark:text-slate-500 mb-1">{t('projectName')}</label>
                          <input
                            type="text"
                            value={editFields.name}
                            onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-slate-500 mb-1">{t('organization')}</label>
                          <input
                            type="text"
                            value={editFields.organization}
                            onChange={e => setEditFields(f => ({ ...f, organization: e.target.value }))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-slate-500 mb-1">{t('team')}</label>
                          <input
                            type="text"
                            value={editFields.team}
                            onChange={e => setEditFields(f => ({ ...f, team: e.target.value }))}
                            placeholder={t('optional')}
                            className={inputClassWithPlaceholder}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-slate-500 mb-1">{t('adoUrl')}</label>
                          <input
                            type="url"
                            value={editFields.adoUrl}
                            onChange={e => setEditFields(f => ({ ...f, adoUrl: e.target.value }))}
                            placeholder={t('optional')}
                            className={inputClassWithPlaceholder}
                          />
                        </div>
                      </div>

                      {/* Reference scores */}
                      <div className="border-t border-gray-200 dark:border-slate-800 pt-4 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-gray-600 dark:text-slate-400">{t('referenceExamples')}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-600 mt-0.5">{t('referenceExamplesDesc')}</p>
                        </div>

                        {scoresLoading ? (
                          <p className="text-xs text-gray-400 dark:text-slate-500">{t('loading')}</p>
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
                                        placeholder={t('workItemTitle')}
                                        className="flex-1 bg-white border border-gray-300 dark:bg-slate-800 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 dark:focus:border-indigo-500"
                                      />
                                      <input
                                        type="number"
                                        value={score.story_points}
                                        onChange={e => updateScoreEntry(score.tempId, 'story_points', e.target.value)}
                                        placeholder={t('sp')}
                                        min="0"
                                        step="0.5"
                                        className="w-16 bg-white border border-gray-300 dark:bg-slate-800 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 dark:focus:border-indigo-500 text-center"
                                      />
                                      <button
                                        onClick={() => removeScoreEntry(score.tempId)}
                                        className="text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors"
                                        title={t('remove')}
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
                                      placeholder={t('optionalDescription')}
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
                              {t('addReferenceItem')}
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
                          {t('cancel')}
                        </button>
                        <button
                          onClick={() => saveEdit(project.id)}
                          disabled={savingEdit || !editFields.name.trim() || !editFields.organization.trim()}
                          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                        >
                          {savingEdit ? t('saving') : t('save')}
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
                          {project.hasPat ? ` · ${t('patConfigured')}` : ''}
                        </p>
                        <p className="text-gray-300 dark:text-slate-600 text-xs mt-1">
                          {t('added')} {new Date(project.created_at).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        {project.hasPat && (
                          <a
                            href={`/${locale}/projects/${project.id}/metrics`}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-medium transition-all shadow-sm hover:shadow-md flex items-center gap-1.5"
                          >
                            <span>📊</span>
                            {t('viewMetrics')}
                          </a>
                        )}
                        <button
                          onClick={() => startEdit(project)}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-900 dark:border-slate-700 dark:hover:border-slate-600 dark:text-slate-400 dark:hover:text-white text-xs font-medium transition-colors"
                        >
                          {t('edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          disabled={deletingId === project.id}
                          className="px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-400 text-red-500 hover:text-red-600 dark:border-red-900/50 dark:hover:border-red-700 dark:text-red-500 dark:hover:text-red-400 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {deletingId === project.id ? '…' : t('delete')}
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

      {/* ── RETROS TAB ── */}
      {activeTab === 'retros' && (
        <section>
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => setRetroModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
            >
              {rt('createRetro')}
            </button>
            <button
              onClick={() => { setJoinCode(''); setJoinError(null); setJoinRetroModalOpen(true); }}
              className="px-4 py-2 rounded-lg border border-violet-400 dark:border-violet-700 text-violet-600 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-sm font-medium transition-colors"
            >
              {rt('joinRetro')}
            </button>
          </div>

          {retrosLoading ? (
            <p className="text-sm text-gray-400 dark:text-slate-500">{rt('loading')}</p>
          ) : retros.length === 0 ? (
            <div className="border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📋</span>
              </div>
              <p className="text-gray-400 dark:text-slate-500 text-sm">{rt('noRetros')}</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {retros.map(r => (
                <div
                  key={r.id}
                  className="relative flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">{r.theme === 'dark' ? '🌑' : '☀️'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.title}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 font-mono">{r.code} · {new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 pr-8">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono uppercase tracking-wide
                      ${r.status === 'writing' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300' :
                        r.status === 'analyzing' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300' :
                        'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
                      {rt(`status_${r.status}`)}
                    </span>
                    <a
                      href={`/${locale}/retro/${r.code}`}
                      className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
                    >
                      {rt('open')}
                    </a>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteRetro(r.code)}
                    disabled={deletingRetroCode === r.code}
                    title={rt('deleteRetro')}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-slate-600 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    {deletingRetroCode === r.code ? (
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

      {/* Modals */}
      {modalOpen && (
        <CreateRoomModal
          initialProjects={projects}
          locale={locale}
          onClose={() => setModalOpen(false)}
        />
      )}
      {retroModalOpen && (
        <CreateRetroModal
          locale={locale}
          onClose={() => setRetroModalOpen(false)}
        />
      )}

      {/* Join Retro Modal */}
      {joinRetroModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setJoinRetroModalOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white mb-5">{rt('joinTitle')}</h2>
            <label className="block text-xs font-medium text-slate-400 mb-1">{rt('joinCodeLabel')}</label>
            <input
              autoFocus
              value={joinCode}
              onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null); }}
              onKeyDown={e => { if (e.key === 'Enter') handleJoinRetro(); if (e.key === 'Escape') setJoinRetroModalOpen(false); }}
              placeholder={rt('joinCodePlaceholder')}
              maxLength={6}
              className="w-full rounded-lg px-3 py-2 text-sm border border-slate-600 bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono uppercase tracking-widest mb-3"
            />
            {joinError && <p className="text-red-400 text-xs mb-3">{joinError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setJoinRetroModalOpen(false)}
                className="flex-1 py-2 text-sm rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-800"
              >
                {rt('cancel')}
              </button>
              <button
                onClick={handleJoinRetro}
                disabled={joining || joinCode.trim().length < 6}
                className="flex-1 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-50"
              >
                {joining ? rt('joining') : rt('joinBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
