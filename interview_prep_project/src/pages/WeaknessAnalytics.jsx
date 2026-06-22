import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl, readApiResponse } from '../api';
import { preparationSections } from '../data/prepSections';
import { getProgress, getProgressBySection } from '../progress';

const getRatingClass = (rating) => {
  if (rating < 45) return 'weak';
  if (rating < 70) return 'practice';
  return 'strong';
};

const MetricBar = ({ label, value }) => (
  <div className="analytics-metric">
    <div>
      <span>{label}</span>
      <strong>{value === null ? 'No data' : `${Math.round(value)}%`}</strong>
    </div>
    <div className="progress-bar">
      <div style={{ width: `${value === null ? 0 : value}%` }} />
    </div>
  </div>
);

const TrendChart = ({ points }) => {
  if (!points?.length) {
    return <div className="empty-state inline-empty">Complete interviews to see score trends.</div>;
  }

  return (
    <div className="trend-chart" aria-label="Interview score trend">
      {points.map((point) => (
        <div className="trend-column" key={point.sessionId}>
          <div className="trend-bar-track">
            <div className="trend-bar" style={{ height: `${point.score}%` }} />
          </div>
          <strong>{point.score}</strong>
          <span>{point.label}</span>
        </div>
      ))}
    </div>
  );
};

const TopicList = ({ title, topics, emptyText }) => (
  <div className="topic-insight-block">
    <h3>{title}</h3>
    {topics?.length ? (
      <div className="topic-insight-list">
        {topics.map((topic) => (
          <article className={`topic-insight-card ${getRatingClass(topic.rating)}`} key={`${title}-${topic.topic}`}>
            <div>
              <span className="prep-meta">{topic.subject}</span>
              <h4>{topic.topic}</h4>
              <p>{topic.answeredCount} related {topic.answeredCount === 1 ? 'answer' : 'answers'}</p>
            </div>
            <strong>{topic.rating}</strong>
          </article>
        ))}
      </div>
    ) : (
      <p className="empty-state inline-empty">{emptyText}</p>
    )}
  </div>
);

const WeaknessAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const sheetProgress = getProgressBySection(preparationSections, getProgress());
        const res = await fetch(apiUrl('/api/interview/analytics'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ sheetProgress })
        });
        const data = await readApiResponse(res);

        if (!res.ok) {
          throw new Error(data.message || 'Unable to load weakness analytics.');
        }

        setAnalytics(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  return (
    <div className="analytics-page">
      <Link className="back-link" to="/dashboard">Back to Dashboard</Link>

      <header className="section-page-hero">
        <div>
          <p className="eyebrow">Weakness Analytics</p>
          <h1>Know where to practice next</h1>
          <p>Ratings combine mock interview scores with progress in your preparation sheets.</p>
        </div>
        <div className="progress-summary">
          <span>{analytics?.weakAreas?.[0]?.rating ?? '-'}</span>
          <p>{analytics?.recommendation || 'rating pending'}</p>
        </div>
      </header>

      {loading && <div className="loading-state">Building weakness analytics...</div>}
      {error && <div className="error-text section-error">{error}</div>}

      {analytics && (
        <>
          <section className="analytics-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Progress Tracking</p>
                <h2>Score trend</h2>
              </div>
              <p>{analytics.improvementHistory?.message}</p>
            </div>

            <div className="performance-overview-grid">
              <article className="performance-stat">
                <span>Latest</span>
                <strong>{analytics.improvementHistory?.latestScore ?? '-'}</strong>
              </article>
              <article className="performance-stat">
                <span>Best</span>
                <strong>{analytics.improvementHistory?.bestScore ?? '-'}</strong>
              </article>
              <article className="performance-stat">
                <span>Net change</span>
                <strong>{analytics.improvementHistory?.netChange === null ? '-' : `${analytics.improvementHistory.netChange > 0 ? '+' : ''}${analytics.improvementHistory.netChange}`}</strong>
              </article>
              <article className="performance-stat">
                <span>Recent avg</span>
                <strong>{analytics.improvementHistory?.recentAverage ?? '-'}</strong>
              </article>
            </div>

            <TrendChart points={analytics.scoreTrend} />
          </section>

          <section className="analytics-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Subject Comparison</p>
                <h2>Interview vs preparation</h2>
              </div>
              <p>Large gaps show where sheet progress has not yet translated into interview performance.</p>
            </div>

            <div className="comparison-grid">
              {analytics.subjectComparisons.map((subject) => (
                <article className="comparison-card" key={subject.subject}>
                  <div className="comparison-card-header">
                    <div>
                      <span className="prep-meta">{subject.subject}</span>
                      <h3>{subject.label}</h3>
                    </div>
                    <strong>{subject.rating}</strong>
                  </div>
                  <MetricBar label="Interview score" value={subject.interviewScore} />
                  <MetricBar label="Sheet progress" value={subject.sheetProgress} />
                  <p>{subject.gap > 15 ? 'Practice timed verbal explanations for this subject.' : 'Interview score and preparation progress are reasonably aligned.'}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="analytics-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Topic Signals</p>
                <h2>Strong and weak topics</h2>
              </div>
              <p>Topic labels are inferred from interview questions, keywords, and historical scores.</p>
            </div>

            <div className="topic-insight-grid">
              <TopicList title="Strong topics" topics={analytics.strongTopics} emptyText="No strong topic signal yet." />
              <TopicList title="Needs focus" topics={analytics.weakTopics} emptyText="No weak topic signal yet." />
            </div>
          </section>

          <section className="analytics-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Weak Areas</p>
                <h2>Priority topics</h2>
              </div>
              <p>Lower rating means the topic needs more practice.</p>
            </div>

            <div className="weak-area-grid">
              {analytics.weakAreas.map((area) => (
                <article className={`weak-area-card ${getRatingClass(area.rating)}`} key={area.topic}>
                  <div className="weak-area-score">
                    <span>{area.rating}</span>
                    <small>/ 100</small>
                  </div>
                  <div>
                    <p className="prep-meta">{area.subject}</p>
                    <h3>{area.topic}</h3>
                    <strong>{area.status}</strong>
                  </div>
                  <MetricBar label="Interview score" value={area.interviewScore} />
                  <MetricBar label="Sheet progress" value={area.sheetProgress} />
                  <p>{area.answeredCount} related interview {area.answeredCount === 1 ? 'answer' : 'answers'} found.</p>
                </article>
              ))}
            </div>
          </section>

          <section className="analytics-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Subject Ratings</p>
                <h2>Overall readiness</h2>
              </div>
              <p>Subjects are sorted from weakest to strongest.</p>
            </div>

            <div className="subject-analytics-list">
              {analytics.subjects.map((subject) => (
                <article className="subject-analytics-row" key={subject.subject}>
                  <div>
                    <span className="prep-meta">{subject.subject}</span>
                    <h3>{subject.label}</h3>
                    <p>{subject.answeredCount} interview {subject.answeredCount === 1 ? 'answer' : 'answers'}</p>
                  </div>
                  <div className="subject-bars">
                    <MetricBar label="Interview" value={subject.interviewScore} />
                    <MetricBar label="Sheet" value={subject.sheetProgress} />
                  </div>
                  <div className={`rating-pill ${getRatingClass(subject.rating)}`}>
                    {subject.rating}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default WeaknessAnalytics;
