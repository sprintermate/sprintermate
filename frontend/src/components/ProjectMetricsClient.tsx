'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SprintMetricsClient from './SprintMetricsClient';

interface Sprint {
  id: string;
  name: string;
  ado_sprint_id: string | null;
  start_date: string | null;
  finish_date: string | null;
}

interface ProjectMetricsClientProps {
  projectId: string;
  projectName: string;
  sprints: Sprint[];
  locale: string;
}

export default function ProjectMetricsClient({
  projectId,
  projectName,
  sprints,
  locale,
}: ProjectMetricsClientProps) {
  const router = useRouter();
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(
    sprints.find(s => s.ado_sprint_id)?.id || null
  );

  const handleSprintChange = useCallback((sprintId: string) => {
    setSelectedSprintId(sprintId);
    // Navigate to the specific sprint metrics page
    router.push(`/${locale}/projects/${projectId}/sprints/${sprintId}`);
  }, [projectId, locale, router]);

  // Filter sprints that have ADO integration
  const adoSprints = sprints.filter(s => s.ado_sprint_id);

  if (adoSprints.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
                No Azure DevOps Sprints
              </h3>
              <p className="text-yellow-700 dark:text-yellow-400 mb-4">
                This project doesn&apos;t have any sprints linked to Azure DevOps yet. To view sprint metrics, you need to:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-700 dark:text-yellow-400">
                <li>Create a planning poker room for this project</li>
                <li>Select a sprint from Azure DevOps when creating the room</li>
                <li>The sprint will then be available for metrics analysis</li>
              </ol>
              <a
                href={`/${locale}/dashboard`}
                className="inline-block mt-4 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedSprint = adoSprints.find(s => s.id === selectedSprintId);

  return (
    <div className="space-y-6">
      {/* Sprint Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-800/60 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              📊 Sprint Analytics
            </h1>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {projectName}
            </p>
          </div>

          <div className="sm:min-w-[300px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-2">
              Select Sprint
            </label>
            <select
              value={selectedSprintId || ''}
              onChange={(e) => handleSprintChange(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
            >
              {adoSprints
                .sort((a, b) => {
                  // Sort by start_date descending (most recent first)
                  if (!a.start_date && !b.start_date) return 0;
                  if (!a.start_date) return 1;
                  if (!b.start_date) return -1;
                  return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
                })
                .map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                    {sprint.start_date && ` (${new Date(sprint.start_date).toLocaleDateString(locale)})`}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sprint Metrics */}
      {selectedSprintId && selectedSprint && (
        <SprintMetricsClient
          projectId={projectId}
          sprintId={selectedSprintId}
          sprintName={selectedSprint.name}
          locale={locale}
        />
      )}
    </div>
  );
}
