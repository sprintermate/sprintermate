'use client';

import { useState } from 'react';

export interface WorkItem {
  id: number;
  title: string;
  description: string;
  state: string;
  storyPoints: number | null;
  workItemType: string;
  assignedTo: string | null;
  acceptanceCriteria: string | null;
}

interface Props {
  items: WorkItem[];
  loading: boolean;
  error: string | null;
  onSelectItem: (item: WorkItem) => void;
}

function stateColor(state: string): string {
  const s = state.toLowerCase();
  if (s === 'active' || s === 'in progress') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  if (s === 'resolved' || s === 'done') return 'bg-green-500/20 text-green-300 border-green-500/30';
  if (s === 'closed' || s === 'completed') return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  if (s === 'new' || s === 'to do') return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
  return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
}

function typeIcon(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('bug')) return '🐛';
  if (t.includes('feature') || t.includes('story')) return '⭐';
  if (t.includes('task')) return '✅';
  if (t.includes('epic')) return '🎯';
  return '📋';
}

export default function WorkItemList({ items, loading, error, onSelectItem }: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'id' | 'title' | 'state' | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  function toggleSort(key: 'id' | 'title' | 'state') {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
  }

  const filtered = items
    .filter((i) =>
      !search ||
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      String(i.id).includes(search),
    )
    .sort((a, b) => {
      if (sortKey === null) return 0; // preserve ADO order
      let cmp = 0;
      if (sortKey === 'id') cmp = a.id - b.id;
      else if (sortKey === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortKey === 'state') cmp = a.state.localeCompare(b.state);
      return sortAsc ? cmp : -cmp;
    });

  function SortIcon({ col }: { col: 'id' | 'title' | 'state' }) {
    if (sortKey !== col) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1 text-indigo-400">{sortAsc ? '↑' : '↓'}</span>;
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 gap-3">
        <svg className="w-5 h-5 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span className="text-sm">Fetching work items from Azure DevOps…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md text-center px-6 py-8 rounded-2xl bg-red-950/40 border border-red-800/40">
          <div className="text-3xl mb-3">⚠️</div>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        No work items found for this sprint.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by ID or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <span className="text-slate-500 text-xs whitespace-nowrap">{filtered.length} items</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800">
              <th className="px-4 py-3 text-left">
                <button onClick={() => toggleSort('id')} className="flex items-center text-slate-400 hover:text-white font-medium text-xs uppercase tracking-wider">
                  # ID <SortIcon col="id" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button onClick={() => toggleSort('title')} className="flex items-center text-slate-400 hover:text-white font-medium text-xs uppercase tracking-wider">
                  Title <SortIcon col="title" />
                </button>
              </th>
              <th className="px-4 py-3 text-left hidden md:table-cell">
                <span className="text-slate-400 font-medium text-xs uppercase tracking-wider">Type</span>
              </th>
              <th className="px-4 py-3 text-left">
                <button onClick={() => toggleSort('state')} className="flex items-center text-slate-400 hover:text-white font-medium text-xs uppercase tracking-wider">
                  Status <SortIcon col="state" />
                </button>
              </th>
              <th className="px-4 py-3 text-center">
                <span className="text-slate-400 font-medium text-xs uppercase tracking-wider">SP</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((item) => (
              <tr
                key={item.id}
                onClick={() => onSelectItem(item)}
                className="bg-slate-950 hover:bg-slate-900/60 cursor-pointer transition-colors group"
              >
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{item.id}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-white font-medium group-hover:text-indigo-300 transition-colors truncate max-w-xs md:max-w-sm lg:max-w-lg">
                      {item.title}
                    </span>
                    {item.assignedTo && (
                      <span className="text-slate-500 text-xs truncate">{item.assignedTo}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-base" title={item.workItemType}>{typeIcon(item.workItemType)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${stateColor(item.state)}`}>
                    {item.state}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {item.storyPoints != null ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs border border-indigo-500/30">
                      {item.storyPoints}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
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
