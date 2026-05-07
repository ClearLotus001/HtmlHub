'use client';

import { useState } from 'react';

function projectKey(category: string, project: string) {
  return `${category}::${project}`;
}

export function useReportFilters() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedIteration, setSelectedIteration] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['default']));
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const ensureCategoryExpanded = (category: string) => {
    setExpandedCategories((prev) => new Set(prev).add(category));
  };

  const toggleProject = (category: string, project: string) => {
    const key = projectKey(category, project);
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const ensureProjectExpanded = (category: string, project: string) => {
    const key = projectKey(category, project);
    setExpandedProjects((prev) => new Set(prev).add(key));
  };

  const selectAllReports = () => {
    setSelectedCategory(null);
    setSelectedProject(null);
    setSelectedIteration(null);
  };

  const selectCategory = (category: string) => {
    toggleCategory(category);
    setSelectedCategory(category);
    setSelectedProject(null);
    setSelectedIteration(null);
  };

  const selectProject = (category: string, project: string) => {
    ensureCategoryExpanded(category);
    toggleProject(category, project);
    setSelectedCategory(category);
    setSelectedProject(project);
    setSelectedIteration(null);
  };

  const selectIteration = (category: string, project: string, iteration: string) => {
    ensureCategoryExpanded(category);
    ensureProjectExpanded(category, project);
    setSelectedCategory(category);
    setSelectedProject(project);
    setSelectedIteration(iteration);
  };

  const submitSearch = () => {
    setQ(qInput.trim());
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedProject(null);
    setSelectedIteration(null);
    setQ('');
    setQInput('');
  };

  return {
    selectedCategory,
    selectedProject,
    selectedIteration,
    expandedCategories,
    expandedProjects,
    q,
    qInput,
    setQInput,
    selectAllReports,
    selectCategory,
    selectProject,
    selectIteration,
    submitSearch,
    clearFilters,
  };
}
