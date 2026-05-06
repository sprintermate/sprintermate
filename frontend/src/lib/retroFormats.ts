export interface RetroColumn {
  key: string;
  labelKey: string;         // i18n key under "retro"
  darkColor: string;        // tailwind text class for dark mode column header
  lightColor: string;       // tailwind text class for light mode column header
  darkCardBg: string;       // tailwind card bg+border for dark mode
  lightCardBg: string;      // tailwind card bg+border for light mode
}

export interface RetroFormat {
  id: string;
  nameKey: string;          // i18n key under "retro"
  descKey: string;          // i18n key under "retro"
  emoji: string;
  columns: RetroColumn[];
}

export const RETRO_FORMATS: RetroFormat[] = [
  {
    id: 'start-stop-continue',
    nameKey: 'formatStartStopContinue',
    descKey: 'formatStartStopContinueDesc',
    emoji: '🔁',
    columns: [
      { key: 'well', labelKey: 'columnWell', darkColor: 'text-emerald-300', lightColor: 'text-emerald-600', darkCardBg: 'bg-emerald-900/70 border-emerald-600/50', lightCardBg: 'bg-emerald-100 border-emerald-400' },
      { key: 'improve', labelKey: 'columnImprove', darkColor: 'text-rose-300', lightColor: 'text-rose-600', darkCardBg: 'bg-rose-900/70 border-rose-600/50', lightCardBg: 'bg-rose-100 border-rose-400' },
      { key: 'ideas', labelKey: 'columnIdeas', darkColor: 'text-yellow-300', lightColor: 'text-amber-600', darkCardBg: 'bg-yellow-900/70 border-yellow-600/50', lightCardBg: 'bg-amber-100 border-amber-400' },
    ],
  },
  {
    id: 'mad-sad-glad',
    nameKey: 'formatMadSadGlad',
    descKey: 'formatMadSadGladDesc',
    emoji: '⭐',
    columns: [
      { key: 'mad', labelKey: 'colMad', darkColor: 'text-red-300', lightColor: 'text-red-600', darkCardBg: 'bg-red-900/70 border-red-600/50', lightCardBg: 'bg-red-100 border-red-400' },
      { key: 'sad', labelKey: 'colSad', darkColor: 'text-blue-300', lightColor: 'text-blue-600', darkCardBg: 'bg-blue-900/70 border-blue-600/50', lightCardBg: 'bg-blue-100 border-blue-400' },
      { key: 'glad', labelKey: 'colGlad', darkColor: 'text-emerald-300', lightColor: 'text-emerald-600', darkCardBg: 'bg-emerald-900/70 border-emerald-600/50', lightCardBg: 'bg-emerald-100 border-emerald-400' },
    ],
  },
  {
    id: 'went-well-improve-actions',
    nameKey: 'formatWentWell',
    descKey: 'formatWentWellDesc',
    emoji: '🚀',
    columns: [
      { key: 'went_well', labelKey: 'colWentWell', darkColor: 'text-emerald-300', lightColor: 'text-emerald-600', darkCardBg: 'bg-emerald-900/70 border-emerald-600/50', lightCardBg: 'bg-emerald-100 border-emerald-400' },
      { key: 'to_improve', labelKey: 'colToImprove', darkColor: 'text-orange-300', lightColor: 'text-orange-600', darkCardBg: 'bg-orange-900/70 border-orange-600/50', lightCardBg: 'bg-orange-100 border-orange-400' },
      { key: 'action_items', labelKey: 'colActionItems', darkColor: 'text-cyan-300', lightColor: 'text-cyan-600', darkCardBg: 'bg-cyan-900/70 border-cyan-600/50', lightCardBg: 'bg-cyan-100 border-cyan-400' },
    ],
  },
  {
    id: '4ls',
    nameKey: 'format4Ls',
    descKey: 'format4LsDesc',
    emoji: '🔥',
    columns: [
      { key: 'liked', labelKey: 'colLiked', darkColor: 'text-emerald-300', lightColor: 'text-emerald-600', darkCardBg: 'bg-emerald-900/70 border-emerald-600/50', lightCardBg: 'bg-emerald-100 border-emerald-400' },
      { key: 'learned', labelKey: 'colLearned', darkColor: 'text-blue-300', lightColor: 'text-blue-600', darkCardBg: 'bg-blue-900/70 border-blue-600/50', lightCardBg: 'bg-blue-100 border-blue-400' },
      { key: 'lacked', labelKey: 'colLacked', darkColor: 'text-orange-300', lightColor: 'text-orange-600', darkCardBg: 'bg-orange-900/70 border-orange-600/50', lightCardBg: 'bg-orange-100 border-orange-400' },
      { key: 'longed_for', labelKey: 'colLongedFor', darkColor: 'text-violet-300', lightColor: 'text-violet-600', darkCardBg: 'bg-violet-900/70 border-violet-600/50', lightCardBg: 'bg-violet-100 border-violet-400' },
    ],
  },
  {
    id: 'sailboat',
    nameKey: 'formatSailboat',
    descKey: 'formatSailboatDesc',
    emoji: '🧠',
    columns: [
      { key: 'wind', labelKey: 'colWind', darkColor: 'text-cyan-300', lightColor: 'text-cyan-600', darkCardBg: 'bg-cyan-900/70 border-cyan-600/50', lightCardBg: 'bg-cyan-100 border-cyan-400' },
      { key: 'anchor', labelKey: 'colAnchor', darkColor: 'text-slate-300', lightColor: 'text-slate-600', darkCardBg: 'bg-slate-700/70 border-slate-500/50', lightCardBg: 'bg-slate-200 border-slate-400' },
      { key: 'rocks', labelKey: 'colRocks', darkColor: 'text-red-300', lightColor: 'text-red-600', darkCardBg: 'bg-red-900/70 border-red-600/50', lightCardBg: 'bg-red-100 border-red-400' },
      { key: 'island', labelKey: 'colIsland', darkColor: 'text-emerald-300', lightColor: 'text-emerald-600', darkCardBg: 'bg-emerald-900/70 border-emerald-600/50', lightCardBg: 'bg-emerald-100 border-emerald-400' },
    ],
  },
  {
    id: 'starfish',
    nameKey: 'formatStarfish',
    descKey: 'formatStarfishDesc',
    emoji: '🎲',
    columns: [
      { key: 'keep', labelKey: 'colKeep', darkColor: 'text-emerald-300', lightColor: 'text-emerald-600', darkCardBg: 'bg-emerald-900/70 border-emerald-600/50', lightCardBg: 'bg-emerald-100 border-emerald-400' },
      { key: 'less', labelKey: 'colLessOf', darkColor: 'text-orange-300', lightColor: 'text-orange-600', darkCardBg: 'bg-orange-900/70 border-orange-600/50', lightCardBg: 'bg-orange-100 border-orange-400' },
      { key: 'more', labelKey: 'colMoreOf', darkColor: 'text-blue-300', lightColor: 'text-blue-600', darkCardBg: 'bg-blue-900/70 border-blue-600/50', lightCardBg: 'bg-blue-100 border-blue-400' },
      { key: 'stop', labelKey: 'colStopDoing', darkColor: 'text-red-300', lightColor: 'text-red-600', darkCardBg: 'bg-red-900/70 border-red-600/50', lightCardBg: 'bg-red-100 border-red-400' },
      { key: 'start', labelKey: 'colStartDoing', darkColor: 'text-violet-300', lightColor: 'text-violet-600', darkCardBg: 'bg-violet-900/70 border-violet-600/50', lightCardBg: 'bg-violet-100 border-violet-400' },
    ],
  },
  {
    id: 'kalm',
    nameKey: 'formatKALM',
    descKey: 'formatKALMDesc',
    emoji: '💡',
    columns: [
      { key: 'keep', labelKey: 'colKeepKalm', darkColor: 'text-emerald-300', lightColor: 'text-emerald-600', darkCardBg: 'bg-emerald-900/70 border-emerald-600/50', lightCardBg: 'bg-emerald-100 border-emerald-400' },
      { key: 'add', labelKey: 'colAdd', darkColor: 'text-blue-300', lightColor: 'text-blue-600', darkCardBg: 'bg-blue-900/70 border-blue-600/50', lightCardBg: 'bg-blue-100 border-blue-400' },
      { key: 'less', labelKey: 'colLess', darkColor: 'text-orange-300', lightColor: 'text-orange-600', darkCardBg: 'bg-orange-900/70 border-orange-600/50', lightCardBg: 'bg-orange-100 border-orange-400' },
      { key: 'more', labelKey: 'colMore', darkColor: 'text-violet-300', lightColor: 'text-violet-600', darkCardBg: 'bg-violet-900/70 border-violet-600/50', lightCardBg: 'bg-violet-100 border-violet-400' },
    ],
  },
  {
    id: 'www',
    nameKey: 'formatWWW',
    descKey: 'formatWWWDesc',
    emoji: '🎯',
    columns: [
      { key: 'worked', labelKey: 'colWorked', darkColor: 'text-emerald-300', lightColor: 'text-emerald-600', darkCardBg: 'bg-emerald-900/70 border-emerald-600/50', lightCardBg: 'bg-emerald-100 border-emerald-400' },
      { key: 'didnt_work', labelKey: 'colDidntWork', darkColor: 'text-rose-300', lightColor: 'text-rose-600', darkCardBg: 'bg-rose-900/70 border-rose-600/50', lightCardBg: 'bg-rose-100 border-rose-400' },
      { key: 'puzzles', labelKey: 'colPuzzles', darkColor: 'text-amber-300', lightColor: 'text-amber-600', darkCardBg: 'bg-amber-900/70 border-amber-600/50', lightCardBg: 'bg-amber-100 border-amber-400' },
    ],
  },
  {
    id: 'experiment',
    nameKey: 'formatExperiment',
    descKey: 'formatExperimentDesc',
    emoji: '🧪',
    columns: [
      { key: 'tried', labelKey: 'colTried', darkColor: 'text-blue-300', lightColor: 'text-blue-600', darkCardBg: 'bg-blue-900/70 border-blue-600/50', lightCardBg: 'bg-blue-100 border-blue-400' },
      { key: 'results', labelKey: 'colResults', darkColor: 'text-emerald-300', lightColor: 'text-emerald-600', darkCardBg: 'bg-emerald-900/70 border-emerald-600/50', lightCardBg: 'bg-emerald-100 border-emerald-400' },
      { key: 'next', labelKey: 'colNext', darkColor: 'text-violet-300', lightColor: 'text-violet-600', darkCardBg: 'bg-violet-900/70 border-violet-600/50', lightCardBg: 'bg-violet-100 border-violet-400' },
    ],
  },
  {
    id: 'glad-confused-suggestions',
    nameKey: 'formatGladConfused',
    descKey: 'formatGladConfusedDesc',
    emoji: '🏗️',
    columns: [
      { key: 'glad', labelKey: 'colGladGCS', darkColor: 'text-emerald-300', lightColor: 'text-emerald-600', darkCardBg: 'bg-emerald-900/70 border-emerald-600/50', lightCardBg: 'bg-emerald-100 border-emerald-400' },
      { key: 'confused', labelKey: 'colConfused', darkColor: 'text-amber-300', lightColor: 'text-amber-600', darkCardBg: 'bg-amber-900/70 border-amber-600/50', lightCardBg: 'bg-amber-100 border-amber-400' },
      { key: 'suggestions', labelKey: 'colSuggestions', darkColor: 'text-blue-300', lightColor: 'text-blue-600', darkCardBg: 'bg-blue-900/70 border-blue-600/50', lightCardBg: 'bg-blue-100 border-blue-400' },
    ],
  },
  {
    id: 'stop-start-keep-more-less',
    nameKey: 'formatSSKML',
    descKey: 'formatSSKMLDesc',
    emoji: '⚡',
    columns: [
      { key: 'start', labelKey: 'colStartSSKML', darkColor: 'text-emerald-300', lightColor: 'text-emerald-600', darkCardBg: 'bg-emerald-900/70 border-emerald-600/50', lightCardBg: 'bg-emerald-100 border-emerald-400' },
      { key: 'stop', labelKey: 'colStopSSKML', darkColor: 'text-red-300', lightColor: 'text-red-600', darkCardBg: 'bg-red-900/70 border-red-600/50', lightCardBg: 'bg-red-100 border-red-400' },
      { key: 'keep', labelKey: 'colKeepSSKML', darkColor: 'text-blue-300', lightColor: 'text-blue-600', darkCardBg: 'bg-blue-900/70 border-blue-600/50', lightCardBg: 'bg-blue-100 border-blue-400' },
      { key: 'more', labelKey: 'colMoreSSKML', darkColor: 'text-violet-300', lightColor: 'text-violet-600', darkCardBg: 'bg-violet-900/70 border-violet-600/50', lightCardBg: 'bg-violet-100 border-violet-400' },
      { key: 'less', labelKey: 'colLessSSKML', darkColor: 'text-orange-300', lightColor: 'text-orange-600', darkCardBg: 'bg-orange-900/70 border-orange-600/50', lightCardBg: 'bg-orange-100 border-orange-400' },
    ],
  },
  {
    id: '5-whys',
    nameKey: 'format5Whys',
    descKey: 'format5WhysDesc',
    emoji: '🔍',
    columns: [
      { key: 'problem', labelKey: 'colProblem', darkColor: 'text-red-300', lightColor: 'text-red-600', darkCardBg: 'bg-red-900/70 border-red-600/50', lightCardBg: 'bg-red-100 border-red-400' },
      { key: 'why1', labelKey: 'colWhy1', darkColor: 'text-orange-300', lightColor: 'text-orange-600', darkCardBg: 'bg-orange-900/70 border-orange-600/50', lightCardBg: 'bg-orange-100 border-orange-400' },
      { key: 'why2', labelKey: 'colWhy2', darkColor: 'text-amber-300', lightColor: 'text-amber-600', darkCardBg: 'bg-amber-900/70 border-amber-600/50', lightCardBg: 'bg-amber-100 border-amber-400' },
      { key: 'root_cause', labelKey: 'colRootCause', darkColor: 'text-emerald-300', lightColor: 'text-emerald-600', darkCardBg: 'bg-emerald-900/70 border-emerald-600/50', lightCardBg: 'bg-emerald-100 border-emerald-400' },
    ],
  },
];

export function getRetroFormat(formatId: string | null | undefined): RetroFormat {
  return RETRO_FORMATS.find(f => f.id === formatId) ?? RETRO_FORMATS[0];
}
