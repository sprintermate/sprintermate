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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-violet-500/50 hover:bg-slate-800 transition text-slate-400 hover:text-violet-300 text-xs font-medium"
      >
        <span className="text-sm">✨</span>
        <span className="hidden sm:inline">AI</span>
      </button>

      {open && <AISettingsModal onClose={() => setOpen(false)} />}
    </>
  );
}
