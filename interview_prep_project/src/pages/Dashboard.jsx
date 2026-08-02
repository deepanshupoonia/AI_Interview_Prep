import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { apiUrl, readApiResponse } from '../api';
import { preparationSections } from '../data/prepSections';
import { getOverallProgress, getProgress, getSectionProgress } from '../progress';

const interviewTopicSections = preparationSections.filter((section) => ['OOP', 'OS', 'DBMS', 'DSA'].includes(section.id));

const buildInitialTopicSelections = () => interviewTopicSections.reduce((accumulator, section) => {
  accumulator[section.id] = {
    topic: section.subsections[0] || '',
    count: 2
  };

  return accumulator;
}, {});

const Dashboard = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [interviewSetupStep, setInterviewSetupStep] = useState(1);
  const [interviewDetailsOpen, setInterviewDetailsOpen] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewId, setInterviewId] = useState(null);
  const [interviewLevel, setInterviewLevel] = useState('Intermediate');
  const [interviewType, setInterviewType] = useState('Core Subjects');
  const [resumeQuestionCount, setResumeQuestionCount] = useState(3);
  const [interviewMinutes, setInterviewMinutes] = useState(30);
  const [remainingSeconds, setRemainingSeconds] = useState(30 * 60);
  const [interviewEndsAt, setInterviewEndsAt] = useState(null);
  const [questionCounts, setQuestionCounts] = useState({
    OOP: 2,
    OS: 2,
    DBMS: 2,
    DSA: 2
  });
  const [topicSelections, setTopicSelections] = useState(() => buildInitialTopicSelections());
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [codeAnswer, setCodeAnswer] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('python');
  const [editableTestCases, setEditableTestCases] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [testRunMessage, setTestRunMessage] = useState('');
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [interviewSummary, setInterviewSummary] = useState(null);
  const [interviewError, setInterviewError] = useState('');
  const [isStartingInterview, setIsStartingInterview] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [progress, setProgress] = useState(() => getProgress());
  const navigate = useNavigate();

  const subjectConfig = {
    OOP: { label: 'OOP', name: 'Object Oriented Programming', max: 10 },
    OS: { label: 'OS', name: 'Operating Systems', max: 10 },
    DBMS: { label: 'DBMS', name: 'Database Management Systems', max: 10 },
    DSA: { label: 'DSA', name: 'Data Structures and Algorithms', max: 5 }
  };

  const codingLanguages = [
    { value: 'python', label: 'Python' },
    { value: 'cpp', label: 'C++' },
    { value: 'c', label: 'C' },
    { value: 'java', label: 'Java' }
  ];

  async function fetchProfile() {
    try {
      const res = await fetch(apiUrl('/api/auth/profile'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProfile();
    const refreshProgress = () => setProgress(getProgress());

    window.addEventListener('focus', refreshProgress);
    return () => window.removeEventListener('focus', refreshProgress);
  }, []);

  useEffect(() => {
    if (!interviewStarted || !interviewEndsAt) return undefined;

    const updateTimer = () => {
      const secondsLeft = Math.max(0, Math.ceil((interviewEndsAt - Date.now()) / 1000));
      setRemainingSeconds(secondsLeft);
    };

    updateTimer();
    const timerId = window.setInterval(updateTimer, 1000);

    return () => window.clearInterval(timerId);
  }, [interviewStarted, interviewEndsAt]);

  useEffect(() => {
    const handleNavEndInterview = () => {
      endInterview();
    };

    window.addEventListener('end-live-interview', handleNavEndInterview);
    return () => window.removeEventListener('end-live-interview', handleNavEndInterview);
  });

  useEffect(() => {
    const minutesLeft = Math.floor(remainingSeconds / 60);
    const secondsLeft = remainingSeconds % 60;
    const formattedTimeLeft = `${minutesLeft}:${String(secondsLeft).padStart(2, '0')}`;

    window.dispatchEvent(new CustomEvent('live-interview-state', {
      detail: {
        active: interviewStarted,
        isTimeUp: interviewStarted && remainingSeconds === 0,
        formattedTimeLeft
      }
    }));
  }, [interviewStarted, remainingSeconds]);

  useEffect(() => {
    if (!currentQuestion) return;

    setAnswer('');
    setCodeLanguage('python');
    setCodeAnswer(currentQuestion.codeTemplates?.python || currentQuestion.starterCode || '');
    setEditableTestCases(currentQuestion.testCases || []);
    setTestResults([]);
    setTestRunMessage('');
  }, [currentQuestion]);

  const runCodeTests = async () => {
    if (!editableTestCases.length) {
      setTestRunMessage('No visible test cases are attached to this question.');
      setTestResults([]);
      return [];
    }

    setIsRunningTests(true);
    setInterviewError('');

    try {
      const res = await fetch(apiUrl(`/api/interview/${interviewId}/run-code`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          language: codeLanguage,
          code: codeAnswer,
          testCases: editableTestCases
        })
      });
      const data = await readApiResponse(res);

      if (!res.ok) {
        throw new Error(data.message || 'Unable to run code.');
      }

      if (!data.ok) {
        setTestResults([]);
        setTestRunMessage(data.message || 'Compilation or execution failed.');
        return [];
      }

      const results = Array.isArray(data.results)
        ? data.results.map((result, index) => ({
          index,
          input: editableTestCases[index]?.input,
          expected: result.expected,
          actual: result.actual,
          passed: Boolean(result.passed)
        }))
        : [];

      setTestResults(results);
      setTestRunMessage(data.message || `${results.filter((result) => result.passed).length} of ${results.length} visible tests passed.`);
      return results;
    } catch (error) {
      setTestResults([]);
      setTestRunMessage(error.message || 'Unable to run code.');
      return [];
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleLanguageChange = (language) => {
    setCodeLanguage(language);
    setCodeAnswer(currentQuestion?.codeTemplates?.[language] || '');
    setTestResults([]);
    setTestRunMessage('');
    setInterviewError('');
  };

  const updateEditableTestCase = (index, field, value) => {
    setEditableTestCases((current) => current.map((testCase, testIndex) => {
      if (testIndex !== index) return testCase;

      try {
        return { ...testCase, [field]: JSON.parse(value) };
      } catch {
        return { ...testCase, [`${field}Text`]: value };
      }
    }));
    setTestResults([]);
    setTestRunMessage('');
  };

  const addEditableTestCase = () => {
    setEditableTestCases((current) => [...current, { input: [], expected: null }]);
    setTestResults([]);
    setTestRunMessage('');
  };

  const startInterview = async () => {
    setInterviewError('');
    setInterviewSummary(null);
    setEvaluation(null);
    setIsStartingInterview(true);

    try {
      const res = await fetch(apiUrl('/api/interview/start'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          interviewType,
          resumeQuestionCount,
          level: interviewLevel,
          counts: questionCounts,
          topicPlan: interviewTopicSections.map((section) => ({
            subject: section.id,
            topic: topicSelections[section.id]?.topic || section.subsections[0] || '',
            count: Math.max(0, Math.min(subjectConfig[section.id]?.max || 10, Number(topicSelections[section.id]?.count || 0)))
          }))
        })
      });
      const data = await readApiResponse(res);
      if (res.ok) {
        const durationSeconds = Math.max(1, Number(interviewMinutes)) * 60;
        setInterviewId(data.interviewId);
        setInterviewStarted(true);
        setRemainingSeconds(durationSeconds);
        setInterviewEndsAt(Date.now() + durationSeconds * 1000);
        setCurrentQuestion(data.question);
      } else {
        setInterviewError(data.message || 'Error starting interview');
      }
    } catch (err) {
      console.error(err);
      setInterviewError('Cannot connect to the interview server.');
    } finally {
      setIsStartingInterview(false);
    }
  };

  const submitAnswer = async (event, answerOverride = null) => {
    event.preventDefault();
    setInterviewError('');
    setIsSubmittingAnswer(true);
    const submittedAnswer = answerOverride ?? answer;

    try {
      const res = await fetch(apiUrl(`/api/interview/${interviewId}/answer`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ answer: submittedAnswer })
      });
      const data = await readApiResponse(res);

      if (!res.ok) {
        setInterviewError(data.message || 'Unable to evaluate answer.');
        return;
      }

      setEvaluation(data.evaluation);
      setInterviewSummary({
        completed: data.completed,
        averageScore: data.averageScore
      });
      setCurrentQuestion(data.nextQuestion || currentQuestion);
      setAnswer('');
      setCodeLanguage('python');
      setCodeAnswer(data.nextQuestion?.codeTemplates?.python || data.nextQuestion?.starterCode || '');
      setEditableTestCases(data.nextQuestion?.testCases || []);
      setTestResults([]);
      setTestRunMessage('');
    } catch (err) {
      console.error(err);
      setInterviewError('Cannot connect to the interview server.');
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const endInterview = () => {
    setInterviewStarted(false);
    setInterviewSetupStep(1);
    setInterviewDetailsOpen(false);
    setInterviewId(null);
    setCurrentQuestion(null);
    setInterviewEndsAt(null);
    setRemainingSeconds(Math.max(1, Number(interviewMinutes)) * 60);
    setAnswer('');
    setCodeAnswer('');
    setEditableTestCases([]);
    setCodeLanguage('python');
    setTestResults([]);
    setTestRunMessage('');
    setIsRunningTests(false);
    setEvaluation(null);
    setInterviewSummary(null);
    setInterviewError('');
    setTopicSelections(buildInitialTopicSelections());
    window.dispatchEvent(new CustomEvent('live-interview-state', {
      detail: {
        active: false,
        isTimeUp: false,
        formattedTimeLeft: '0:00'
      }
    }));
  };

  const openInterviewDetails = () => {
    setInterviewSetupStep(2);
    setInterviewDetailsOpen(true);
  };

  const closeInterviewDetails = () => {
    setInterviewDetailsOpen(false);
    setInterviewSetupStep(1);
  };

  if (loading) return <div className="loading-state">Loading your dashboard...</div>;
  if (!profile) return null;

  const isTimeUp = interviewStarted && remainingSeconds === 0;
  const isCodingQuestion = currentQuestion?.questionType === 'coding';
  const visibleTestsPassed = testResults.length > 0 && testResults.every((result) => result.passed);

  if (interviewStarted) {
    return (
      <div className="interview-session">
        <div className="interview-header">
          <div>
            <p className="eyebrow">Live Practice</p>
            <h2>{interviewLevel} {interviewType} Interview</h2>
            {currentQuestion && (
              <p className="interview-progress-text">
                {currentQuestion.isFollowUp ? 'Contextual follow-up' : `Question ${currentQuestion.number} of ${currentQuestion.total}`}
              </p>
            )}
          </div>
        </div>

        {currentQuestion && (
          <>
            <div className="interview-question-meta">
              <span>{currentQuestion.subject}</span>
              <span>{currentQuestion.subjectLabel}</span>
              {currentQuestion.isFollowUp && <span>AI follow-up</span>}
            </div>
            <div className="question-box">
              {currentQuestion.questionText}
            </div>
          </>
        )}

        {interviewError && <div className="error-text">{interviewError}</div>}
        {isTimeUp && <div className="error-text">Interview time is up. End the session or review your last evaluation.</div>}

        {evaluation && (
          <div className="evaluation-panel">
            <div className="score-ring" aria-label={`Score ${evaluation.score} out of 10`}>
              <strong>{evaluation.score}</strong>
              <span>/ 10</span>
            </div>
            <div>
              <h3>AI Evaluation</h3>
              <p>{evaluation.feedback}</p>
              <div className="feedback-grid">
                <div>
                  <h4>Strengths</h4>
                  <ul>
                    {evaluation.strengths.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <h4>Improve</h4>
                  <ul>
                    {evaluation.improvements.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {interviewSummary?.completed ? (
          <div className="interview-complete-panel">
            <p className="eyebrow">Session Complete</p>
            <h3>Average score: {interviewSummary.averageScore} / 10</h3>
            <p>Your dashboard stats are updated with this interview attempt.</p>
            <button className="btn" type="button" onClick={endInterview}>Back to Dashboard</button>
          </div>
        ) : (
          <form className="answer-panel" onSubmit={async (event) => {
            if (isCodingQuestion) {
              event.preventDefault();
              const latestResults = testResults.length ? testResults : await runCodeTests();

              if (!latestResults.length || latestResults.some((result) => !result.passed)) {
                setInterviewError('Run the visible tests and pass all of them before submitting your code.');
                return;
              }

              setAnswer(JSON.stringify({
                type: 'coding',
                language: codeLanguage,
                code: codeAnswer,
                testResults: latestResults
              }));
              submitAnswer(event, JSON.stringify({
                type: 'coding',
                language: codeLanguage,
                code: codeAnswer,
                testResults: latestResults
              }));
              return;
            }

            submitAnswer(event);
          }}>
            {isCodingQuestion ? (
              <>
                <section className="coding-workspace">
                  <div className="coding-problem-panel">
                    <span className="prep-meta">Coding Problem</span>
                    <h3>{currentQuestion.title || currentQuestion.questionText}</h3>
                    <p>{currentQuestion.description || currentQuestion.questionText}</p>
                    <div className="coding-example-list">
                      {editableTestCases.slice(0, 2).map((testCase, index) => (
                        <article className="coding-example" key={index}>
                          <strong>Example {index + 1}</strong>
                          <p>Input: {JSON.stringify(testCase.input)}</p>
                          <p>Output: {JSON.stringify(testCase.expected)}</p>
                        </article>
                      ))}
                    </div>
                    {currentQuestion.constraints?.length > 0 && (
                      <div className="coding-constraints">
                        <strong>Constraints</strong>
                        <ul>
                          {currentQuestion.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="coding-editor-panel">
                    <label htmlFor="code-language">Language</label>
                    <select
                      id="code-language"
                      value={codeLanguage}
                      onChange={(event) => handleLanguageChange(event.target.value)}
                      disabled={isTimeUp}
                    >
                      {codingLanguages.map((language) => (
                        <option key={language.value} value={language.value}>{language.label}</option>
                      ))}
                    </select>
                    <label htmlFor="candidate-code">Code editor</label>
                    <textarea
                      id="candidate-code"
                      className="code-editor"
                      value={codeAnswer}
                      onChange={(event) => {
                        setCodeAnswer(event.target.value);
                        setTestResults([]);
                        setTestRunMessage('');
                        setInterviewError('');
                      }}
                      rows="16"
                      spellCheck="false"
                      disabled={isTimeUp}
                    />
                  </div>
                </section>
                <div className="test-case-panel">
                  <div className="answer-actions">
                    <span>{testRunMessage || `${editableTestCases.length || 0} visible tests`}</span>
                    <button className="btn btn-secondary" type="button" onClick={runCodeTests} disabled={isTimeUp || isRunningTests}>
                      {isRunningTests ? 'Running...' : 'Run Tests'}
                    </button>
                  </div>
                  {testResults.length > 0 && (
                    <div className="test-result-list">
                      {testResults.map((result) => (
                        <article className={result.passed ? 'test-result passed' : 'test-result failed'} key={result.index}>
                          <strong>Test {result.index + 1}: {result.passed ? 'Passed' : 'Failed'}</strong>
                          <p>Input: {JSON.stringify(result.input)}</p>
                          <p>Expected: {JSON.stringify(result.expected)}</p>
                          <p>Actual: {JSON.stringify(result.actual)}</p>
                        </article>
                      ))}
                    </div>
                  )}
                  <div className="editable-test-grid">
                    {editableTestCases.map((testCase, index) => (
                      <article className="editable-test-card" key={index}>
                        <strong>Editable Test {index + 1}</strong>
                        <label>
                          <span>Input JSON</span>
                          <textarea
                            value={JSON.stringify(testCase.input)}
                            onChange={(event) => updateEditableTestCase(index, 'input', event.target.value)}
                            rows="3"
                          />
                        </label>
                        <label>
                          <span>Expected JSON</span>
                          <textarea
                            value={JSON.stringify(testCase.expected)}
                            onChange={(event) => updateEditableTestCase(index, 'expected', event.target.value)}
                            rows="2"
                          />
                        </label>
                      </article>
                    ))}
                    <button className="btn btn-secondary" type="button" onClick={addEditableTestCase}>
                      Add Test Case
                    </button>
                  </div>
                </div>
                <div className="answer-actions">
                  <span>{visibleTestsPassed ? 'Ready for AI evaluation' : 'Pass visible tests before submitting'}</span>
                  <button className="btn" type="submit" disabled={isTimeUp || isSubmittingAnswer || !visibleTestsPassed}>
                    {isSubmittingAnswer ? 'Evaluating...' : 'Submit Code'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label htmlFor="candidate-answer">Type your answer</label>
                <textarea
                  id="candidate-answer"
                  placeholder="Write your answer like you would explain it to an interviewer..."
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  rows="7"
                  disabled={isTimeUp}
                />
                <div className="answer-actions">
                  <span>{answer.trim().length} characters</span>
                  <button className="btn" type="submit" disabled={isTimeUp || isSubmittingAnswer || answer.trim().length < 20}>
                    {isSubmittingAnswer ? 'Evaluating...' : evaluation ? 'Submit Response' : 'Submit Answer'}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    );
  }

  const overallProgress = getOverallProgress(preparationSections, progress);

  return (
    <div className="dashboard-container">
      <div className="dashboard-menu-shell">
        <button className="hamburger-button dashboard-menu-button" type="button" aria-label="Open dashboard sections">
          <span />
          <span />
          <span />
        </button>
        <aside className="dashboard-hover-sidebar" aria-label="Dashboard sections">
          <p className="eyebrow">Sections</p>
          <nav className="section-slide-list">
            <NavLink className="sidebar-section-card" to="/dashboard">
              Dashboard
            </NavLink>
            <NavLink className="sidebar-section-card" to="/resume">
              Resume
            </NavLink>
            <NavLink className="sidebar-section-card" to="/history">
              Interview History
            </NavLink>
            <NavLink className="sidebar-section-card" to="/analytics">
              Weakness Analytics
            </NavLink>
            {preparationSections.map((section) => (
              <NavLink
                className={({ isActive }) => (
                  isActive ? 'sidebar-section-card active' : 'sidebar-section-card'
                )}
                key={section.id}
                to={`/sections/${section.slug}`}
              >
                {section.title}
              </NavLink>
            ))}
          </nav>
        </aside>
      </div>

      <div className="dashboard-header">
        <p className="eyebrow">Dashboard</p>
        <h1>Welcome, {profile.name}!</h1>
        <p>Let's get ready for your next big opportunity.</p>
      </div>

        <div className="dashboard-main">
          <div className="dashboard-grid">
        
            {/* Stats Section */}
            <div className="stat-card performance-card">
              <div className="section-library-header performance-header">
                <div>
                  <p className="eyebrow">Performance</p>
                  <h3>Your performance snapshot</h3>
                </div>
                <p>Track interview momentum, readiness, and your strongest category at a glance.</p>
              </div>
              <div className="performance-overview-grid compact">
                <article className="performance-stat">
                  <span>Total interviews</span>
                  <strong>{profile.stats.total_interviews}</strong>
                  <p>Completed mock sessions</p>
                </article>
                <article className="performance-stat">
                  <span>Overall average</span>
                  <strong>{profile.stats.overall_avg_score}</strong>
                  <p>Out of 100</p>
                </article>
                <article className="performance-stat">
                  <span>Best category</span>
                  <strong>{profile.stats.highest_score_category || 'N/A'}</strong>
                  <p>Highest scoring area</p>
                </article>
                <article className="performance-stat accent">
                  <span>Preparation progress</span>
                  <strong>{overallProgress.percent}%</strong>
                  <p>Across all sections</p>
                </article>
              </div>
            </div>

            {/* Start Interview Section */}
            <div className="dashboard-lower-row">
              <div className="action-card interview-wizard interview-compact-card">
                <h3>Start New Interview</h3>
                <p>Pick the interview type and level. The rest opens in a popup so this card stays simple.</p>
                {interviewError && <div className="error-text">{interviewError}</div>}
                <div className="action-form interview-intro-row">
                  <label htmlFor="interview-type">Interview type</label>
                  <select id="interview-type" value={interviewType} onChange={(event) => setInterviewType(event.target.value)}>
                    <option value="Core Subjects">Core Subjects</option>
                    <option value="Resume-Based">Resume-Based</option>
                    <option value="Mixed">Mixed</option>
                  </select>
                  <label htmlFor="interview-level">Interview level</label>
                  <select id="interview-level" value={interviewLevel} onChange={(event) => setInterviewLevel(event.target.value)}>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                  <div className="admin-form-actions">
                    <button className="btn" type="button" onClick={openInterviewDetails} disabled={!interviewLevel || !interviewType}>
                      Continue
                    </button>
                  </div>
                </div>
              </div>

              <section className="dashboard-feature-strip">
                <Link className="feature-link-card" to="/history">
                  <span className="prep-meta">Saved Sessions</span>
                  <h3>Interview History</h3>
                  <p>Review questions, answers, ratings, and feedback from every completed mock interview.</p>
                </Link>
                <Link className="feature-link-card" to="/analytics">
                  <span className="prep-meta">Practice Focus</span>
                  <h3>Weakness Analytics</h3>
                  <p>Find weak topics like Graphs, Deadlocks, and Normalization using interview scores plus sheet progress.</p>
                </Link>
              </section>
            </div>

          </div>

          {interviewDetailsOpen && (
            <div className="interview-modal-backdrop" role="presentation" onClick={closeInterviewDetails}>
              <div className="interview-modal" role="dialog" aria-modal="true" aria-label="Interview details" onClick={(event) => event.stopPropagation()}>
                <div className="interview-modal-header">
                  <div>
                    <p className="eyebrow">Step 2</p>
                    <h3>Choose the remaining details</h3>
                    <p>Pick topics, counts, duration, and resume-based options before starting.</p>
                  </div>
                  <button className="icon-button" type="button" onClick={closeInterviewDetails} aria-label="Close interview details">X</button>
                </div>
                <div className="interview-modal-body" onClick={(event) => event.stopPropagation()}>
                  {interviewType !== 'Resume-Based' && (
                    <div className="topic-selection-grid">
                      {interviewTopicSections.map((section) => (
                        <article className="topic-selection-card" key={section.id}>
                          <span className="prep-meta">{section.title}</span>
                          <label htmlFor={`topic-${section.id}`}>Topic</label>
                          <select
                            id={`topic-${section.id}`}
                            value={topicSelections[section.id]?.topic || section.subsections[0] || ''}
                            onChange={(event) => {
                              const topic = event.target.value;
                              setTopicSelections((current) => ({
                                ...current,
                                [section.id]: {
                                  ...current[section.id],
                                  topic
                                }
                              }));
                            }}
                          >
                            {section.subsections.map((subsection) => (
                              <option key={subsection} value={subsection}>{subsection}</option>
                            ))}
                          </select>
                          <label htmlFor={`count-${section.id}`}>Questions</label>
                          <input
                            id={`count-${section.id}`}
                            type="number"
                            min="0"
                            max={subjectConfig[section.id]?.max || 10}
                            value={topicSelections[section.id]?.count ?? 0}
                            onChange={(event) => {
                              const maxCount = subjectConfig[section.id]?.max || 10;
                              const count = Math.max(0, Math.min(maxCount, Number(event.target.value || 0)));
                              setTopicSelections((current) => ({
                                ...current,
                                [section.id]: {
                                  ...current[section.id],
                                  count
                                }
                              }));
                              setQuestionCounts((current) => ({ ...current, [section.id]: count }));
                            }}
                            aria-label={`${section.title} question count`}
                          />
                        </article>
                      ))}
                    </div>
                  )}

                  {interviewType !== 'Core Subjects' && (
                    <section className="wizard-step-panel compact modal-section">
                      <label htmlFor="resume-question-count">Resume questions</label>
                      <input
                        id="resume-question-count"
                        type="number"
                        min="1"
                        max="10"
                        value={resumeQuestionCount}
                        onChange={(event) => setResumeQuestionCount(Math.max(1, Math.min(10, Number(event.target.value || 1))))}
                      />
                      <Link className="back-link inline-link" to="resume">Review saved resume</Link>
                    </section>
                  )}

                  <section className="wizard-step-panel modal-section">
                    <label htmlFor="interview-duration">Interview duration</label>
                    <div className="duration-control">
                      <input
                        id="interview-duration"
                        type="number"
                        min="5"
                        max="180"
                        step="5"
                        value={interviewMinutes}
                        onChange={(event) => {
                          const value = Math.max(5, Math.min(180, Number(event.target.value || 5)));
                          setInterviewMinutes(value);
                          setRemainingSeconds(value * 60);
                        }}
                        aria-label="Interview duration in minutes"
                      />
                      <span>minutes</span>
                    </div>
                    <div className="interview-total-row">
                      <span>Total questions</span>
                      <strong>
                        {interviewType === 'Resume-Based'
                          ? resumeQuestionCount
                          : Object.values(topicSelections).reduce((total, item) => total + Number(item.count || 0), 0) + (interviewType === 'Mixed' ? Math.min(3, resumeQuestionCount) : 0)}
                      </strong>
                    </div>
                    {interviewType === 'Resume-Based' && <div className="empty-state inline-empty">Resume-only interviews use the uploaded resume plus the selected time limit.</div>}
                  </section>
                </div>
                <div className="interview-modal-footer">
                  <button className="btn btn-secondary" type="button" onClick={closeInterviewDetails}>Back</button>
                  <button className="btn" type="button" onClick={startInterview} disabled={isStartingInterview}>
                    {isStartingInterview ? 'Starting...' : 'Begin Mock Interview'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <section className="section-library">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Preparation Library</p>
                <h2>Choose a section to practice</h2>
              </div>
              <p>Use the sections rail to jump between areas, or open a card below for topics and progress.</p>
            </div>

            <div className="section-card-grid">
              {preparationSections.map((section) => (
                <article className="prep-card" key={section.id}>
                  {(() => {
                    const sectionProgress = getSectionProgress(section, progress);

                    return (
                      <div className="card-progress">
                        <span>{sectionProgress.percent}% complete</span>
                        <div className="progress-bar">
                          <div style={{ width: `${sectionProgress.percent}%` }} />
                        </div>
                      </div>
                    );
                  })()}
                  <div className="prep-card-header">
                    <div>
                      <span className="prep-meta">{section.meta}</span>
                      <h3>{section.title}</h3>
                    </div>
                    <span className="prep-count">{section.subsections.length}</span>
                  </div>
                  <p>{section.description}</p>
                  <div className="subsection-list">
                    {section.subsections.map((subsection) => (
                      <button
                        className="subsection-chip"
                        key={subsection}
                        type="button"
                        onClick={() => {
                          navigate(`/sections/${section.slug}`);
                        }}
                        title={`Practice ${subsection}`}
                      >
                        {subsection}
                      </button>
                    ))}
                  </div>
                  <Link className="btn prep-action" to={`/sections/${section.slug}`}>Open {section.title}</Link>
                </article>
              ))}
            </div>
          </section>
        </div>
    </div>
  );
};

export default Dashboard;
