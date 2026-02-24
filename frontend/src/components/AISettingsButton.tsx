'use client';

import { useState } from 'react';
import AISettingsModal from './AISettingsModal';

export default function AISettingsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="AI Settings"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 hover:border-teal-400/50 hover:bg-gray-200 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-violet-500/50 dark:hover:bg-slate-800 transition text-gray-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-violet-300 text-xs font-medium"
      >
        <span className="text-sm">✨</span>
        <span className="hidden sm:inline">AI</span>
      </button>

      {open && <AISettingsModal onClose={() => setOpen(false)} />}
    </>
  );
}
