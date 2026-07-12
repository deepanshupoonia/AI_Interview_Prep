import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl, readApiResponse } from '../api';

const emptyParsed = {
  education: [],
  skills: [],
  projects: [],
  experience: [],
  achievements: []
};

const sectionLabels = {
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  experience: 'Experience',
  achievements: 'Achievements'
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const ResumePage = () => {
  const [resume, setResume] = useState(null);
  const [parsed, setParsed] = useState(emptyParsed);
  const [rawText, setRawText] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingBase64, setPendingBase64] = useState('');
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResume = async () => {
      try {
        const res = await fetch(apiUrl('/api/resume'), {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await readApiResponse(res);

        if (res.ok && data.resume) {
          setResume(data.resume);
          setParsed({ ...emptyParsed, ...data.resume.parsed });
          setRawText(data.resume.rawText || '');
        }
      } catch {
        setError('Unable to load resume.');
      } finally {
        setLoading(false);
      }
    };

    fetchResume();
  }, []);

  const parseFile = async (file) => {
    setError('');
    setMessage('');
    setParsing(true);

    try {
      const dataBase64 = await fileToBase64(file);
      const res = await fetch(apiUrl('/api/resume/parse'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          dataBase64
        })
      });
      const data = await readApiResponse(res);

      if (!res.ok) {
        setError(data.message || 'Unable to parse resume.');
        return;
      }

      setPendingFile(file);
      setPendingBase64(dataBase64);
      setParsed({ ...emptyParsed, ...data.parsed });
      setRawText(data.rawText || '');
      setMessage('Review the parsed resume, edit anything missing, then save.');
    } catch {
      setError('Unable to parse resume.');
    } finally {
      setParsing(false);
    }
  };

  const updateSection = (section, value) => {
    setParsed((current) => ({
      ...current,
      [section]: value.split('\n').map((item) => item.trim()).filter(Boolean)
    }));
  };

  const saveResume = async () => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const endpoint = pendingFile ? '/api/resume' : '/api/resume';
      const method = pendingFile ? 'POST' : 'PUT';
      const body = pendingFile
        ? {
          fileName: pendingFile.name,
          mimeType: pendingFile.type,
          dataBase64: pendingBase64,
          rawText,
          parsed
        }
        : { rawText, parsed };

      const res = await fetch(apiUrl(endpoint), {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(body)
      });
      const data = await readApiResponse(res);

      if (!res.ok) {
        setError(data.message || 'Unable to save resume.');
        return;
      }

      setResume(data.resume);
      setPendingFile(null);
      setPendingBase64('');
      setMessage('Resume saved.');
    } catch {
      setError('Cannot connect to resume server.');
    } finally {
      setSaving(false);
    }
  };

  const deleteResume = async () => {
    setError('');
    setMessage('');

    try {
      const res = await fetch(apiUrl('/api/resume'), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await readApiResponse(res);

      if (!res.ok) {
        setError(data.message || 'Unable to delete resume.');
        return;
      }

      setResume(null);
      setParsed(emptyParsed);
      setRawText('');
      setPendingFile(null);
      setPendingBase64('');
      setMessage('Resume removed.');
    } catch {
      setError('Cannot connect to resume server.');
    }
  };

  if (loading) return <div className="loading-state">Loading resume...</div>;

  return (
    <div className="resume-page">
      <Link className="back-link" to="/dashboard">Back to Dashboard</Link>

      <header className="section-page-hero">
        <div>
          <p className="eyebrow">Resume</p>
          <h1>Resume profile</h1>
          <p>Upload one PDF or DOCX resume, review the parsed sections, and save it for resume-based interviews.</p>
        </div>
        <div className="progress-summary">
          <span>{resume ? 'Saved' : 'New'}</span>
          <p>{pendingFile?.name || resume?.fileName || 'No resume uploaded'}</p>
        </div>
      </header>

      {error && <div className="error-text">{error}</div>}
      {message && <div className="success-text">{message}</div>}

      <section className="resume-panel">
        <div className="resume-upload-row">
          <label htmlFor="resume-file">Upload or replace resume</label>
          <input
            id="resume-file"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) parseFile(file);
            }}
          />
          {parsing && <span>Parsing resume...</span>}
        </div>

        <div className="resume-editor-grid">
          {Object.keys(sectionLabels).map((section) => (
            <label className="resume-section-editor" key={section}>
              <span>{sectionLabels[section]}</span>
              <textarea
                value={(parsed[section] || []).join('\n')}
                onChange={(event) => updateSection(section, event.target.value)}
                placeholder={`One ${sectionLabels[section].toLowerCase()} item per line`}
                rows="7"
              />
            </label>
          ))}
        </div>

        <label className="resume-raw-text">
          <span>Extracted raw text</span>
          <textarea value={rawText} onChange={(event) => setRawText(event.target.value)} rows="8" />
        </label>

        <div className="answer-actions">
          <button className="btn" type="button" onClick={saveResume} disabled={saving}>
            {saving ? 'Saving...' : 'Save Resume'}
          </button>
          {resume && (
            <button className="btn btn-danger" type="button" onClick={deleteResume}>
              Delete Resume
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

export default ResumePage;
