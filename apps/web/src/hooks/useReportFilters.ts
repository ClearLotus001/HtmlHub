'use client';

import { useState } from 'react';

export function useReportFilters() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedIteration, setSelectedIteration] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');

  const toggleProject = (project: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(project)) next.delete(project);
      else next.add(project);
      return next;
    });
  };

  const selectAllReports = () => {
    setSelectedProject(null);
    setSelectedIteration(null);
  };

  const selectProject = (project: string) => {
    toggleProject(project);
    setSelectedProject(project);
    setSelectedIteration(null);
  };

  const selectIteration = (project: string, iteration: string) => {
    setSelectedProject(project);
    setSelectedIteration(iteration);
  };

  const submitSearch = () => {
    setQ(qInput.trim());
  };

  const clearFilters = () => {
    setSelectedProject(null);
    setSelectedIteration(null);
    setQ('');
    setQInput('');
  };

  return {
    selectedProject,
    selectedIteration,
    expandedProjects,
    q,
    qInput,
    setQInput,
    selectAllReports,
    selectProject,
    selectIteration,
    submitSearch,
    clearFilters,
  };
}
