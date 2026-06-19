import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl, readApiResponse } from '../api';

const formatDate = (value) => {
  if (!value) return 'In progress';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
};

const InterviewHistory = () => {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(apiUrl('/api/interview/history'), {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await readApiResponse(res);

        if (!res.ok) {
          throw new Error(data.message || 'Unable to load interview history.');
        }

        setSessions(data.sessions || []);
        setActiveSessionId(data.sessions?.[0]?.id || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <div className="history-page">
      <Link className="back-link" to="/dashboard">Back to Dashboard</Link>

      <header className="section-page-hero">
        <div>
          <p className="eyebrow">Interview History</p>
          <h1>Your saved mock interview sessions</h1>
          <p>Review each question, your answer, score, feedback, strengths, and improvement areas.</p>
        </div>
        <div className="progress-summary">
          <span>{sessions.length}</span>
          <p>saved sessions</p>
        </div>
      </header>

      {loading && <div className="loading-state">Loading interview history...</div>}
      {error && <div className="error-text section-error">{error}</div>}

      {!loading && sessions.length === 0 && (
        <div className="empty-state">No interview history yet. Complete a mock interview to see it here.</div>
      )}

      <div className="history-list">
        {sessions.map((session) => {
          const open = activeSessionId === session.id;

          return (
            <article className="history-session" key={session.id}>
              <button
                className="history-session-header"
                type="button"
                onClick={() => setActiveSessionId(open ? null : session.id)}
              >
                <div>
                  <span className="prep-meta">{session.level} {session.type}</span>
                  <h2>Session #{session.id}</h2>
                  <p>{formatDate(session.startedAt)}</p>
                </div>
                <div className="history-score">
                  <strong>{session.averageScore ?? '-'}</strong>
                  <span>/ 10</span>
                </div>
              </button>

              {open && (
                <div className="history-question-list">
                  {session.questions.map((question) => (
                    <section className="history-question" key={question.id}>
                      <div className="interview-question-meta">
                        <span>{question.position}. {question.subject}</span>
                        <span>{question.subjectLabel}</span>
                        {question.score !== null && <span>{question.score} / 10</span>}
                      </div>
                      <h3>{question.questionText}</h3>
                      {question.answer ? (
                        <>
                          <p className="history-answer">{question.answer}</p>
                          <p>{question.feedback}</p>
                          <div className="feedback-grid">
                            <div>
                              <h4>Strengths</h4>
                              <ul>
                                {question.strengths.map((item) => <li key={item}>{item}</li>)}
                              </ul>
                            </div>
                            <div>
                              <h4>Improve</h4>
                              <ul>
                                {question.improvements.map((item) => <li key={item}>{item}</li>)}
                              </ul>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="empty-state inline-empty">No answer submitted for this question.</p>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default InterviewHistory;
