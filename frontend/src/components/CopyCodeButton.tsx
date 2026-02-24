'use client';

import { useTranslations } from 'next-intl';

interface Props {
  code: string;
}

export default function CopyCodeButton({ code }: Props) {
  const t = useTranslations('room');
  return (
    <button
      onClick={() => navigator.clipboard?.writeText(code)}
      className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
      title={t('copyRoomCode')}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>
  );
}
