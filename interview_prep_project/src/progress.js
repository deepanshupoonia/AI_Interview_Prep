const STORAGE_KEY = 'interview-prep-progress';

export const getProgress = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

export const isItemComplete = (progress, sectionId, itemId) => {
  return Boolean(progress?.[sectionId]?.[itemId]);
};

export const getSectionProgress = (section, progress) => {
  const total = section.totalItems || section.items.length;
  const completed = section.totalItems
    ? Object.values(progress?.[section.id] || {}).filter(Boolean).length
    : section.items.filter((item) => isItemComplete(progress, section.id, item.progressId || item.id)).length;

  return {
    completed: Math.min(completed, total),
    total,
    percent: total === 0 ? 0 : Math.round((Math.min(completed, total) / total) * 100)
  };
};

export const getOverallProgress = (sections, progress) => {
  const totals = sections.reduce((summary, section) => {
    const sectionProgress = getSectionProgress(section, progress);

    return {
      completed: summary.completed + sectionProgress.completed,
      total: summary.total + sectionProgress.total
    };
  }, { completed: 0, total: 0 });

  return {
    ...totals,
    percent: totals.total === 0 ? 0 : Math.round((totals.completed / totals.total) * 100)
  };
};

export const toggleProgressItem = (sectionId, itemId) => {
  const progress = getProgress();
  const sectionProgress = progress[sectionId] || {};

  progress[sectionId] = {
    ...sectionProgress,
    [itemId]: !sectionProgress[itemId]
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  return progress;
};
