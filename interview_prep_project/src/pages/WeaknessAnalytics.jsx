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
