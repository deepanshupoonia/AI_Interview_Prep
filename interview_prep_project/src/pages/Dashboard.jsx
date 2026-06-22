import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { apiUrl, readApiResponse } from '../api';
import { preparationSections } from '../data/prepSections';
import { getOverallProgress, getProgress, getSectionProgress } from '../progress';

const Dashboard = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewId, setInterviewId] = useState(null);
  const [interviewLevel, setInterviewLevel] = useState('Intermediate');
  const [questionCounts, setQuestionCounts] = useState({
    OOP: 2,
    OS: 2,
    DBMS: 2,
    DSA: 2
  });
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
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
          level: interviewLevel,
          counts: questionCounts
        })
      });
      const data = await readApiResponse(res);
      if (res.ok) {
        setInterviewId(data.interviewId);
        setInterviewStarted(true);
        setCurrentQuestion(data.question);
        setAnswer('');
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

  const submitAnswer = async (event) => {
    event.preventDefault();
    setInterviewError('');
    setIsSubmittingAnswer(true);

    try {
      const res = await fetch(apiUrl(`/api/interview/${interviewId}/answer`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ answer })
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
    } catch (err) {
      console.error(err);
      setInterviewError('Cannot connect to the interview server.');
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const endInterview = () => {
    setInterviewStarted(false);
    setInterviewId(null);
    setCurrentQuestion(null);
    setAnswer('');
    setEvaluation(null);
    setInterviewSummary(null);
    setInterviewError('');
  };

  if (loading) return <div className="loading-state">Loading your dashboard...</div>;
  if (!profile) return null;

  if (interviewStarted) {
    return (
      <div className="interview-session">
        <div className="interview-header">
          <div>
            <p className="eyebrow">Live Practice</p>
            <h2>{interviewLevel} Mixed Mock Interview</h2>
            {currentQuestion && (
              <p className="interview-progress-text">
                {currentQuestion.isFollowUp ? 'Contextual follow-up' : `Question ${currentQuestion.number} of ${currentQuestion.total}`}
              </p>
            )}
          </div>
          <button className="btn btn-danger" onClick={endInterview}>
            End Session
          </button>
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
          <form className="answer-panel" onSubmit={submitAnswer}>
            <label htmlFor="candidate-answer">Type your answer</label>
            <textarea
              id="candidate-answer"
              placeholder="Write your answer like you would explain it to an interviewer..."
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows="7"
            />
            <div className="answer-actions">
              <span>{answer.trim().length} characters</span>
              <button className="btn" type="submit" disabled={isSubmittingAnswer || answer.trim().length < 20}>
                {isSubmittingAnswer ? 'Evaluating...' : evaluation ? 'Submit Response' : 'Submit Answer'}
              </button>
            </div>
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
            <div className="stat-card">
              <h3>Your Performance Stats</h3>
              <div className="stat-item">
                <span>Total Interviews</span>
                <span className="stat-value">{profile.stats.total_interviews}</span>
              </div>
              <div className="stat-item">
                <span>Overall Average Score</span>
                <span className="stat-value">{profile.stats.overall_avg_score} / 100</span>
              </div>
              <div className="stat-item">
                <span>Best Category</span>
                <span className="stat-value accent-value">{profile.stats.highest_score_category || 'N/A'}</span>
              </div>
              <div className="stat-item">
                <span>Preparation Progress</span>
                <span className="stat-value accent-value">{overallProgress.percent}%</span>
              </div>
            </div>

            {/* Start Interview Section */}
            <div className="action-card">
              <h3>Start New Interview</h3>
              <p>Choose the interview level and how many questions you want from each subject.</p>
              {interviewError && <div className="error-text">{interviewError}</div>}
              <div className="action-form">
                <label htmlFor="interview-level">Interview level</label>
                <select id="interview-level" value={interviewLevel} onChange={(event) => setInterviewLevel(event.target.value)}>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
                <div className="question-count-grid">
                  {Object.entries(subjectConfig).map(([subject, config]) => (
                    <label className="question-count-control" key={subject} htmlFor={`count-${subject}`}>
                      <span>
                        <strong>{config.label}</strong>
                        <small>0 - {config.max}</small>
                      </span>
                      <input
                        id={`count-${subject}`}
                        type="number"
                        min="0"
                        max={config.max}
                        value={questionCounts[subject]}
                        onChange={(event) => {
                          const value = Math.max(0, Math.min(config.max, Number(event.target.value || 0)));
                          setQuestionCounts((current) => ({ ...current, [subject]: value }));
                        }}
                        aria-label={`${config.name} question count`}
                      />
                    </label>
                  ))}
                </div>
                <div className="interview-total-row">
                  <span>Total questions</span>
                  <strong>{Object.values(questionCounts).reduce((total, count) => total + Number(count), 0)}</strong>
                </div>
                <button className="btn" onClick={startInterview} disabled={isStartingInterview}>
                  {isStartingInterview ? 'Starting...' : 'Begin Mock Interview'}
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
