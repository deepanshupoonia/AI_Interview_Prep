import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { apiUrl, readApiResponse } from '../api';
import { getSectionBySlug } from '../data/prepSections';
import { getProgress, getSectionProgress, isItemComplete, toggleProgressItem } from '../progress';

const buildCompanyStats = (questions) => {
  const companyCounts = new Map();

  questions.forEach((question) => {
    const company = question.company || 'Unknown';
    const key = company;

    if (!companyCounts.has(key)) {
      companyCounts.set(key, {
        company,
        leetcodeIds: new Set()
      });
    }

    companyCounts.get(key).leetcodeIds.add(String(question.leetcode_id));
  });

  return Array.from(companyCounts.values()).map((company) => ({
    company: company.company,
    total_questions: company.leetcodeIds.size
  }));
};

const getCompanyLabel = (company) => {
  return company.company;
};

const SectionPage = () => {
  const { slug } = useParams();
  const section = getSectionBySlug(slug);
  const [progress, setProgress] = useState(() => getProgress());
  const [activeSubsection, setActiveSubsection] = useState('All');
  const [companyItems, setCompanyItems] = useState([]);
  const [remoteSubsections, setRemoteSubsections] = useState([]);
  const [companyStats, setCompanyStats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [questionError, setQuestionError] = useState('');
  const [questionsLoading, setQuestionsLoading] = useState(false);

  useEffect(() => {
    if (!section || section.id !== 'DSA') return;

    const fetchDsaQuestions = async () => {
      setQuestionsLoading(true);
      setQuestionError('');

      try {
        const res = await fetch(apiUrl('/api/dsa/questions'), {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await readApiResponse(res);

        if (!res.ok) {
          throw new Error(data.message || 'Unable to load DSA questions');
        }

        const questions = Array.isArray(data) ? data : Array.isArray(data?.questions) ? data.questions : null;

        if (!Array.isArray(questions)) {
          throw new Error('DSA API returned an unexpected response. Please restart the backend server and try again.');
        }

        const companies = Array.isArray(data?.companies) ? data.companies : buildCompanyStats(questions);

        const normalizedCompanyItems = questions.map((question) => {
          const questionId = String(question.leetcode_id);
          const companyLabel = question.company || 'Unknown';

          return {
            id: `leetcode-${questionId}-${companyLabel.toLowerCase().replace(/\s+/g, '-')}`,
            progressId: `leetcode-${questionId}`,
            leetcodeId: questionId,
            title: question.title,
            type: `LeetCode #${questionId}`,
            difficulty: question.difficulty,
            subsection: companyLabel,
            companies: [companyLabel],
            appearances: [{
              company: question.company,
              label: companyLabel,
              priority: question.priority_order,
              frequency: question.frequency
            }],
            url: question.problem_url,
            priority: question.priority_order,
            acceptance: question.acceptance
          };
        });

        const companyLabels = companies.map(getCompanyLabel);

        setCompanyItems(normalizedCompanyItems);
        setRemoteSubsections(companyLabels);
        setCompanyStats(companies);
      } catch (error) {
        setQuestionError(error.message);
      } finally {
        setQuestionsLoading(false);
      }
    };

    fetchDsaQuestions();
  }, [section]);

  const displaySection = useMemo(() => {
    if (!section) return null;

    if (section.id === 'DSA' && companyItems.length > 0) {
      return {
        ...section,
        subsections: remoteSubsections,
        items: companyItems
      };
    }

    return section;
  }, [section, companyItems, remoteSubsections]);

  const sectionProgress = useMemo(() => {
    if (!displaySection) return { completed: 0, total: 0, percent: 0 };
    return getSectionProgress(displaySection, progress);
  }, [displaySection, progress]);

  if (!section) {
    return <Navigate to="/dashboard" replace />;
  }

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const sectionItems = Array.isArray(displaySection.items) ? displaySection.items : [];
  const sectionSubsections = Array.isArray(displaySection.subsections) ? displaySection.subsections : [];
  const visibleItems = sectionItems
    .filter((item) => activeSubsection === 'All' || item.companies?.includes(activeSubsection) || item.subsection === activeSubsection)
    .filter((item) => {
      if (section.id !== 'DSA' || !normalizedSearch) return true;

      return [
        item.leetcodeId,
        item.title,
        item.difficulty,
        item.type,
        ...(item.companies || [])
      ].some((value) => String(value).toLowerCase().includes(normalizedSearch));
    })
    .sort((a, b) => {
      if (section.id !== 'DSA' || activeSubsection === 'All') return a.priority - b.priority;

      const aAppearance = a.appearances?.find((appearance) => appearance.label === activeSubsection);
      const bAppearance = b.appearances?.find((appearance) => appearance.label === activeSubsection);

      return (aAppearance?.priority || a.priority) - (bAppearance?.priority || b.priority);
    });

  const visibleGroups = section.id === 'DSA'
    ? (activeSubsection === 'All' ? remoteSubsections : [activeSubsection])
      .map((companyLabel) => ({
        companyLabel,
        items: visibleItems.filter((item) => item.companies?.includes(companyLabel))
      }))
      .filter((group) => group.items.length > 0)
    : [{ companyLabel: '', items: visibleItems }];

  const getCompanyProgress = (companyLabel) => {
    const itemsForCompany = companyItems.filter((item) => item.companies?.includes(companyLabel));
    const completed = itemsForCompany.filter((item) => isItemComplete(progress, section.id, item.progressId || item.id)).length;

    return {
      completed,
      total: itemsForCompany.length,
      percent: itemsForCompany.length === 0 ? 0 : Math.round((completed / itemsForCompany.length) * 100)
    };
  };

  const handleToggle = (itemId) => {
    setProgress(toggleProgressItem(section.id, itemId));
  };

  return (
    <div className="section-page">
      <Link className="back-link" to="/dashboard">Back to Dashboard</Link>

      <header className="section-page-hero">
        <div>
          <p className="eyebrow">{section.meta}</p>
          <h1>{section.contentTitle}</h1>
          <p>{section.contentDescription}</p>
        </div>
        <div className="progress-summary">
          <span>{sectionProgress.percent}%</span>
          <p>{sectionProgress.completed} of {sectionProgress.total} complete</p>
          <div className="progress-bar">
            <div style={{ width: `${sectionProgress.percent}%` }} />
          </div>
        </div>
      </header>

      {section.id === 'DSA' && (
        <section className="dsa-control-panel">
          <div>
            <h2>Company-wise DSA Questions</h2>
            <p>Switch companies, search inside the selected list, and mark solved problems.</p>
          </div>
          <div className="dsa-filter-tools">
            <label className="dsa-company-select">
              <span>Company</span>
              <select
                aria-label="Select DSA company list"
                value={activeSubsection}
                onChange={(event) => setActiveSubsection(event.target.value)}
              >
                <option value="All">All Companies</option>
                {sectionSubsections.map((subsection) => (
                  <option key={subsection} value={subsection}>{subsection}</option>
                ))}
              </select>
            </label>
            <div className="dsa-search-field">
              <input
                aria-label="Search DSA questions"
                placeholder={activeSubsection === 'All' ? 'Search #200, island, Amazon, hard...' : `Search inside ${activeSubsection}...`}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery && (
                <button
                  className="btn btn-secondary dsa-clear-search"
                  type="button"
                  onClick={() => setSearchQuery('')}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {section.id === 'DSA' && companyStats.length > 0 && (
        <div className="company-progress-grid">
          <button
            className={activeSubsection === 'All' ? 'company-progress-card active' : 'company-progress-card'}
            type="button"
            onClick={() => setActiveSubsection('All')}
          >
            <span className="prep-meta">All Companies</span>
            <strong>{sectionProgress.percent}% complete</strong>
            <p>{sectionProgress.completed} of {sectionProgress.total} solved</p>
            <div className="progress-bar">
              <div style={{ width: `${sectionProgress.percent}%` }} />
            </div>
          </button>
          {remoteSubsections.map((companyLabel) => {
            const companyProgress = getCompanyProgress(companyLabel);

            return (
              <button
                className={activeSubsection === companyLabel ? 'company-progress-card active' : 'company-progress-card'}
                key={companyLabel}
                type="button"
                onClick={() => setActiveSubsection(companyLabel)}
              >
                <span className="prep-meta">{companyLabel}</span>
                <strong>{companyProgress.percent}% complete</strong>
                <p>{companyProgress.completed} of {companyProgress.total} solved</p>
                <div className="progress-bar">
                  <div style={{ width: `${companyProgress.percent}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="topic-tabs">
        {['All', ...sectionSubsections].map((subsection) => (
          <button
            className={activeSubsection === subsection ? 'topic-tab active' : 'topic-tab'}
            key={subsection}
            type="button"
            onClick={() => setActiveSubsection(subsection)}
          >
            {subsection}
          </button>
        ))}
      </div>

      {questionsLoading && <div className="loading-state">Loading DSA questions...</div>}
      {questionError && <div className="error-text section-error">{questionError}</div>}

      {section.id === 'DSA' && !questionsLoading && (
        <div className="question-result-summary">
          Showing {visibleItems.length} {visibleItems.length === 1 ? 'question' : 'questions'}
          {activeSubsection !== 'All' ? ` for ${activeSubsection}` : ' across all companies'}
          {normalizedSearch ? ` matching "${searchQuery.trim()}"` : ''}
        </div>
      )}

      {section.id === 'DSA' && normalizedSearch && visibleItems.length === 0 && !questionsLoading && (
        <div className="empty-state">No questions matched your search.</div>
      )}

      <div className="content-list">
        {visibleGroups.map((group) => (
          <section className="company-question-group" key={group.companyLabel || section.id}>
            {section.id === 'DSA' && (
              <div className="company-question-heading">
                <div>
                  <span className="prep-meta">Company List</span>
                  <h2>{group.companyLabel}</h2>
                </div>
                <strong>{group.items.length} {group.items.length === 1 ? 'question' : 'questions'}</strong>
              </div>
            )}

            <div className="company-question-list">
              {group.items.map((item) => {
                const complete = isItemComplete(progress, section.id, item.progressId || item.id);
                const activeAppearance = item.appearances?.find((appearance) => appearance.label === item.subsection);
                const displayPriority = activeAppearance?.priority || item.priority;

                return (
                  <article className={complete ? 'content-card complete' : 'content-card'} key={item.id}>
                    <label className="complete-toggle">
                      <input
                        checked={complete}
                        type="checkbox"
                        onChange={() => handleToggle(item.progressId || item.id)}
                      />
                      <span>{complete ? 'Done' : 'Todo'}</span>
                    </label>
                    <div className="content-card-main">
                      <span className="company-pill">{item.subsection}</span>
                      <h3>{displayPriority ? `${displayPriority}. ${item.title}` : item.title}</h3>
                      <div className="content-tags">
                        <span>{item.type}</span>
                        <span>{item.difficulty}</span>
                        {item.acceptance && <span>{item.acceptance} acceptance</span>}
                      </div>
                    </div>
                    {item.url && (
                      <a className="content-link" href={item.url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default SectionPage;
