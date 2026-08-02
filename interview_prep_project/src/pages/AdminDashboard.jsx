import { useEffect, useMemo, useState } from 'react';
import { apiUrl, readApiResponse } from '../api';

const adminHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`
});

const emptySubjectForm = {
  id: null,
  name: '',
  slug: '',
  description: '',
  icon: '',
  displayOrder: 0,
  difficulties: 'Beginner, Intermediate, Advanced',
  status: 'active'
};

const emptyPromptForm = {
  id: null,
  subjectId: '',
  promptType: 'system',
  content: ''
};

const emptyMaterialForm = {
  id: null,
  subjectId: '',
  title: '',
  description: '',
  materialType: 'pdf',
  tags: '',
  difficulty: 'Intermediate',
  visibility: 'private',
  storageKey: '',
  sourceUrl: '',
  mimeType: '',
  status: 'active',
  jobStatus: 'pending',
  embeddingStatus: 'pending'
};

const emptyQuestionForm = {
  id: null,
  subjectId: '',
  questionText: '',
  difficulty: 'Intermediate',
  topic: '',
  tags: '',
  answerHint: '',
  status: 'active',
  bulkSource: 'admin'
};

const emptySettingForm = {
  subjectId: '',
  maxQuestions: 5,
  timeLimitMinutes: 30,
  difficultyDistribution: '{\n  "Beginner": 25,\n  "Intermediate": 55,\n  "Advanced": 20\n}',
  aiModel: 'gpt-5.4-mini',
  temperature: 0.7,
  retrievalSettings: '{\n  "topK": 5,\n  "similarityThreshold": 0.75\n}'
};

const safeParse = (value, fallback) => {
  try {
    if (typeof value === 'object' && value !== null) {
      return value;
    }

    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const formatTags = (tags) => {
  if (Array.isArray(tags)) {
    return tags.join(', ');
  }

  return tags || '';
};

const adminStats = [
  { key: 'users', label: 'Total users' },
  { key: 'interviews', label: 'Total interviews' },
  { key: 'activeSubjects', label: 'Active subjects' },
  { key: 'materials', label: 'Uploaded materials' },
  { key: 'jobs', label: 'Queued jobs' }
];

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [settings, setSettings] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedPromptType, setSelectedPromptType] = useState('system');
  const [subjectForm, setSubjectForm] = useState(emptySubjectForm);
  const [promptForm, setPromptForm] = useState(emptyPromptForm);
  const [materialForm, setMaterialForm] = useState(emptyMaterialForm);
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm);
  const [settingForm, setSettingForm] = useState(emptySettingForm);
  const [bulkQuestions, setBulkQuestions] = useState('[]');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const filteredPrompts = useMemo(() => prompts.filter((prompt) => String(prompt.subject_id) === String(selectedSubjectId)), [prompts, selectedSubjectId]);
  const filteredMaterials = useMemo(() => materials.filter((material) => String(material.subject_id) === String(selectedSubjectId)), [materials, selectedSubjectId]);
  const filteredQuestions = useMemo(() => questions.filter((question) => String(question.subject_id) === String(selectedSubjectId)), [questions, selectedSubjectId]);
  const currentSettings = useMemo(() => settings.find((setting) => String(setting.subject_id) === String(selectedSubjectId)) || null, [settings, selectedSubjectId]);

  const loadAdminData = async () => {
    setLoading(true);
    setError('');

    try {
      const [summaryRes, subjectsRes, promptsRes, materialsRes, questionsRes, settingsRes, jobsRes] = await Promise.all([
        fetch(apiUrl('/api/admin/summary'), { headers: adminHeaders() }),
        fetch(apiUrl('/api/admin/subjects'), { headers: adminHeaders() }),
        fetch(apiUrl('/api/admin/prompts'), { headers: adminHeaders() }),
        fetch(apiUrl('/api/admin/materials'), { headers: adminHeaders() }),
        fetch(apiUrl('/api/admin/questions'), { headers: adminHeaders() }),
        fetch(apiUrl('/api/admin/settings'), { headers: adminHeaders() }),
        fetch(apiUrl('/api/admin/jobs'), { headers: adminHeaders() })
      ]);

      const [summaryData, subjectsData, promptsData, materialsData, questionsData, settingsData, jobsData] = await Promise.all([
        readApiResponse(summaryRes),
        readApiResponse(subjectsRes),
        readApiResponse(promptsRes),
        readApiResponse(materialsRes),
        readApiResponse(questionsRes),
        readApiResponse(settingsRes),
        readApiResponse(jobsRes)
      ]);

      if (!summaryRes.ok) throw new Error(summaryData.message || 'Unable to load dashboard summary.');
      if (!subjectsRes.ok) throw new Error(subjectsData.message || 'Unable to load subjects.');
      if (!promptsRes.ok) throw new Error(promptsData.message || 'Unable to load prompts.');
      if (!materialsRes.ok) throw new Error(materialsData.message || 'Unable to load materials.');
      if (!questionsRes.ok) throw new Error(questionsData.message || 'Unable to load questions.');
      if (!settingsRes.ok) throw new Error(settingsData.message || 'Unable to load settings.');
      if (!jobsRes.ok) throw new Error(jobsData.message || 'Unable to load jobs.');

      const nextSubjects = subjectsData.subjects || [];
      setSummary(summaryData);
      setSubjects(nextSubjects);
      setPrompts(promptsData.prompts || []);
      setMaterials(materialsData.materials || []);
      setQuestions(questionsData.questions || []);
      setSettings(settingsData.settings || []);
      setJobs(jobsData.jobs || []);

      if (!selectedSubjectId && nextSubjects.length > 0) {
        const firstSubjectId = String(nextSubjects[0].id);
        setSelectedSubjectId(firstSubjectId);
        setSubjectForm({
          id: nextSubjects[0].id,
          name: nextSubjects[0].name || '',
          slug: nextSubjects[0].slug || '',
          description: nextSubjects[0].description || '',
          icon: nextSubjects[0].icon || '',
          displayOrder: nextSubjects[0].display_order || 0,
          difficulties: formatTags(nextSubjects[0].difficulties),
          status: nextSubjects[0].status || 'active'
        });
        setPromptForm((current) => ({ ...current, subjectId: firstSubjectId }));
        setMaterialForm((current) => ({ ...current, subjectId: firstSubjectId }));
        setQuestionForm((current) => ({ ...current, subjectId: firstSubjectId }));
        setSettingForm((current) => ({
          ...current,
          subjectId: firstSubjectId,
          maxQuestions: nextSubjects[0].max_questions ?? 5,
          timeLimitMinutes: nextSubjects[0].time_limit_minutes ?? 30,
          difficultyDistribution: JSON.stringify(safeParse(nextSubjects[0].difficulty_distribution, {}), null, 2),
          aiModel: nextSubjects[0].ai_model || 'gpt-5.4-mini',
          temperature: nextSubjects[0].temperature ?? 0.7,
          retrievalSettings: JSON.stringify(safeParse(nextSubjects[0].retrieval_settings, {}), null, 2)
        }));
      }
    } catch (fetchError) {
      setError(fetchError.message || 'Unable to load admin workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0) {
      setSelectedSubjectId(String(subjects[0].id));
    }
  }, [selectedSubjectId, subjects]);

  useEffect(() => {
    const nextSetting = currentSettings;

    if (nextSetting && String(nextSetting.subject_id) === String(selectedSubjectId)) {
      setSettingForm((current) => ({
        ...current,
        subjectId: String(nextSetting.subject_id),
        maxQuestions: nextSetting.max_questions ?? 5,
        timeLimitMinutes: nextSetting.time_limit_minutes ?? 30,
        difficultyDistribution: JSON.stringify(safeParse(nextSetting.difficulty_distribution, {}), null, 2),
        aiModel: nextSetting.ai_model || 'gpt-5.4-mini',
        temperature: nextSetting.temperature ?? 0.7,
        retrievalSettings: JSON.stringify(safeParse(nextSetting.retrieval_settings, {}), null, 2)
      }));
    }
  }, [currentSettings, selectedSubjectId]);

  const apiAction = async (path, options = {}) => {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: {
        ...adminHeaders(),
        ...options.headers
      }
    });
    const data = await readApiResponse(response);

    if (!response.ok) {
      throw new Error(data.message || 'Request failed.');
    }

    return data;
  };

  const handleSubjectSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        name: subjectForm.name,
        slug: subjectForm.slug,
        description: subjectForm.description,
        icon: subjectForm.icon,
        displayOrder: Number(subjectForm.displayOrder),
        difficulties: subjectForm.difficulties.split(',').map((item) => item.trim()).filter(Boolean),
        status: subjectForm.status
      };

      if (subjectForm.id) {
        await apiAction(`/api/admin/subjects/${subjectForm.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiAction('/api/admin/subjects', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setSubjectForm(emptySubjectForm);
      setMessage('Subject saved successfully.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const editSubject = (subject) => {
    setSelectedSubjectId(String(subject.id));
    setSubjectForm({
      id: subject.id,
      name: subject.name || '',
      slug: subject.slug || '',
      description: subject.description || '',
      icon: subject.icon || '',
      displayOrder: subject.display_order || 0,
      difficulties: formatTags(subject.difficulties),
      status: subject.status || 'active'
    });
  };

  const removeSubject = async (subjectId) => {
    setSaving(true);
    setError('');
    try {
      await apiAction(`/api/admin/subjects/${subjectId}`, { method: 'DELETE' });
      await loadAdminData();
      setMessage('Subject disabled.');
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePromptSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      await apiAction('/api/admin/prompts', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: Number(promptForm.subjectId),
          promptType: promptForm.promptType,
          content: promptForm.content
        })
      });
      setPromptForm((current) => ({ ...emptyPromptForm, subjectId: current.subjectId || selectedSubjectId, promptType: current.promptType }));
      setMessage('Prompt version saved.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const rollbackPrompt = async (promptId) => {
    setSaving(true);
    setError('');
    try {
      await apiAction(`/api/admin/prompts/${promptId}/rollback`, { method: 'POST' });
      setMessage('Prompt rolled back to the selected version.');
      await loadAdminData();
    } catch (rollbackError) {
      setError(rollbackError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleMaterialSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        subjectId: Number(materialForm.subjectId),
        title: materialForm.title,
        description: materialForm.description,
        materialType: materialForm.materialType,
        tags: materialForm.tags.split(',').map((item) => item.trim()).filter(Boolean),
        difficulty: materialForm.difficulty,
        visibility: materialForm.visibility,
        storageKey: materialForm.storageKey,
        sourceUrl: materialForm.sourceUrl,
        mimeType: materialForm.mimeType,
        status: materialForm.status,
        jobStatus: materialForm.jobStatus,
        embeddingStatus: materialForm.embeddingStatus
      };

      if (materialForm.id) {
        await apiAction(`/api/admin/materials/${materialForm.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiAction('/api/admin/materials', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setMaterialForm(emptyMaterialForm);
      setMessage('Study material saved.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const editMaterial = (material) => {
    setMaterialForm({
      id: material.id,
      subjectId: material.subject_id,
      title: material.title || '',
      description: material.description || '',
      materialType: material.material_type || 'pdf',
      tags: formatTags(material.tags),
      difficulty: material.difficulty || 'Intermediate',
      visibility: material.visibility || 'private',
      storageKey: material.storage_key || '',
      sourceUrl: material.source_url || '',
      mimeType: material.mime_type || '',
      status: material.status || 'active',
      jobStatus: material.job_status || 'pending',
      embeddingStatus: material.embedding_status || 'pending'
    });
    setSelectedSubjectId(String(material.subject_id));
  };

  const removeMaterial = async (materialId) => {
    setSaving(true);
    setError('');
    try {
      await apiAction(`/api/admin/materials/${materialId}`, { method: 'DELETE' });
      setMessage('Material archived.');
      await loadAdminData();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleQuestionSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        subjectId: Number(questionForm.subjectId),
        questionText: questionForm.questionText,
        difficulty: questionForm.difficulty,
        topic: questionForm.topic,
        tags: questionForm.tags.split(',').map((item) => item.trim()).filter(Boolean),
        answerHint: questionForm.answerHint,
        status: questionForm.status,
        bulkSource: questionForm.bulkSource
      };

      if (questionForm.id) {
        await apiAction(`/api/admin/questions/${questionForm.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiAction('/api/admin/questions', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setQuestionForm(emptyQuestionForm);
      setMessage('Question saved.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const editQuestion = (question) => {
    setQuestionForm({
      id: question.id,
      subjectId: question.subject_id,
      questionText: question.question_text || '',
      difficulty: question.difficulty || 'Intermediate',
      topic: question.topic || '',
      tags: formatTags(question.tags),
      answerHint: question.answer_hint || '',
      status: question.status || 'active',
      bulkSource: question.bulk_source || 'admin'
    });
    setSelectedSubjectId(String(question.subject_id));
  };

  const removeQuestion = async (questionId) => {
    setSaving(true);
    setError('');
    try {
      await apiAction(`/api/admin/questions/${questionId}`, { method: 'DELETE' });
      setMessage('Question archived.');
      await loadAdminData();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setSaving(false);
    }
  };

  const importQuestions = async () => {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const parsed = safeParse(bulkQuestions, []);
      if (!Array.isArray(parsed)) {
        throw new Error('Bulk import payload must be a JSON array.');
      }

      await apiAction('/api/admin/questions/import', {
        method: 'POST',
        body: JSON.stringify({ questions: parsed })
      });
      setMessage('Bulk questions imported.');
      await loadAdminData();
    } catch (importError) {
      setError(importError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSettingsSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      await apiAction(`/api/admin/settings/${settingForm.subjectId}`, {
        method: 'PUT',
        body: JSON.stringify({
          maxQuestions: Number(settingForm.maxQuestions),
          timeLimitMinutes: Number(settingForm.timeLimitMinutes),
          difficultyDistribution: safeParse(settingForm.difficultyDistribution, {}),
          aiModel: settingForm.aiModel,
          temperature: Number(settingForm.temperature),
          retrievalSettings: safeParse(settingForm.retrievalSettings, {})
        })
      });

      setMessage('Subject settings updated.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const retryJob = async (jobId) => {
    setSaving(true);
    setError('');
    try {
      await apiAction(`/api/admin/jobs/${jobId}/retry`, { method: 'POST' });
      setMessage('Job re-queued.');
      await loadAdminData();
    } catch (retryError) {
      setError(retryError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading-state">Loading admin dashboard...</div>;
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-hero">
        <div>
          <p className="eyebrow">Admin Control Center</p>
          <h1>Manage subjects, prompts, materials, and interview rules</h1>
          <p>Everything here is data-driven. Add new subjects and content without editing source files.</p>
        </div>
        <div className="admin-hero-actions">
          <button className="btn btn-secondary" type="button" onClick={loadAdminData} disabled={saving}>Refresh</button>
          <button className="btn" type="button" onClick={() => window.location.href = '/dashboard'}>Open Student App</button>
        </div>
      </header>

      {error && <div className="error-text">{error}</div>}
      {message && <div className="success-text">{message}</div>}

      <section className="admin-stats-grid">
        {adminStats.map((stat) => (
          <article className="admin-stat-card" key={stat.key}>
            <span>{stat.label}</span>
            <strong>{summary?.totals?.[stat.key] ?? 0}</strong>
          </article>
        ))}
      </section>

      <section className="admin-job-summary">
        <article><strong>{summary?.jobStatusCounts?.pending ?? 0}</strong><span>Pending</span></article>
        <article><strong>{summary?.jobStatusCounts?.processing ?? 0}</strong><span>Processing</span></article>
        <article><strong>{summary?.jobStatusCounts?.completed ?? 0}</strong><span>Completed</span></article>
        <article><strong>{summary?.jobStatusCounts?.failed ?? 0}</strong><span>Failed</span></article>
      </section>

      <nav className="admin-tabs">
        {['overview', 'subjects', 'prompts', 'materials', 'questions', 'settings', 'jobs'].map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? 'admin-tab active' : 'admin-tab'}
            type="button"
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <section className="admin-panel-grid">
          <article className="admin-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Recent uploads</p>
                <h2>Latest material jobs</h2>
              </div>
            </div>
            <div className="admin-list">
              {summary?.recentUploads?.length ? summary.recentUploads.map((item) => (
                <article className="admin-list-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.subject_name} • {item.material_type}</p>
                  </div>
                  <span>{item.job_status}</span>
                </article>
              )) : <p className="empty-state inline-empty">No uploads yet.</p>}
            </div>
          </article>
          <article className="admin-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Quick Filters</p>
                <h2>Active subjects</h2>
              </div>
            </div>
            <div className="admin-chip-list">
              {subjects.filter((subject) => subject.status === 'active').map((subject) => (
                <button key={subject.id} type="button" className="admin-chip" onClick={() => setSelectedSubjectId(String(subject.id))}>
                  {subject.icon || '•'} {subject.name}
                </button>
              ))}
            </div>
          </article>
        </section>
      )}

      {activeTab === 'subjects' && (
        <section className="admin-panel-grid two-column">
          <article className="admin-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Subject Management</p>
                <h2>{subjectForm.id ? 'Edit subject' : 'Create subject'}</h2>
              </div>
            </div>
            <form className="admin-form" onSubmit={handleSubjectSubmit}>
              <label>Subject name<input value={subjectForm.name} onChange={(event) => setSubjectForm({ ...subjectForm, name: event.target.value })} /></label>
              <label>Slug<input value={subjectForm.slug} onChange={(event) => setSubjectForm({ ...subjectForm, slug: event.target.value })} /></label>
              <label>Icon<input value={subjectForm.icon} onChange={(event) => setSubjectForm({ ...subjectForm, icon: event.target.value })} placeholder="🧩" /></label>
              <label>Display order<input type="number" value={subjectForm.displayOrder} onChange={(event) => setSubjectForm({ ...subjectForm, displayOrder: event.target.value })} /></label>
              <label>Difficulty levels<textarea value={subjectForm.difficulties} onChange={(event) => setSubjectForm({ ...subjectForm, difficulties: event.target.value })} rows="2" /></label>
              <label>Description<textarea value={subjectForm.description} onChange={(event) => setSubjectForm({ ...subjectForm, description: event.target.value })} rows="4" /></label>
              <label>Status<select value={subjectForm.status} onChange={(event) => setSubjectForm({ ...subjectForm, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
              <div className="admin-form-actions">
                <button className="btn" type="submit" disabled={saving}>Save Subject</button>
                <button className="btn btn-secondary" type="button" onClick={() => setSubjectForm(emptySubjectForm)} disabled={saving}>Reset</button>
              </div>
            </form>
          </article>

          <article className="admin-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Existing Subjects</p>
                <h2>Ordered catalog</h2>
              </div>
            </div>
            <div className="admin-list">
              {subjects.map((subject) => (
                <article className="admin-list-row" key={subject.id}>
                  <div>
                    <strong>{subject.icon || '•'} {subject.name}</strong>
                    <p>{subject.slug} • {subject.status} • {subject.total_questions} questions</p>
                  </div>
                  <div className="admin-row-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => editSubject(subject)}>Edit</button>
                    <button className="btn btn-danger" type="button" onClick={() => removeSubject(subject.id)} disabled={saving}>Disable</button>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>
      )}

      {activeTab === 'prompts' && (
        <section className="admin-panel-grid two-column">
          <article className="admin-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Prompt Management</p>
                <h2>Versioned prompt editor</h2>
              </div>
            </div>
            <form className="admin-form" onSubmit={handlePromptSubmit}>
              <label>Subject<select value={promptForm.subjectId || selectedSubjectId} onChange={(event) => setPromptForm({ ...promptForm, subjectId: event.target.value })}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
              <label>Prompt type<select value={promptForm.promptType} onChange={(event) => setPromptForm({ ...promptForm, promptType: event.target.value })}><option value="system">System prompt</option><option value="interview">Interview prompt</option><option value="follow-up">Follow-up prompt</option><option value="evaluation">Evaluation prompt</option><option value="support">Support prompt</option></select></label>
              <label>Prompt content<textarea value={promptForm.content} onChange={(event) => setPromptForm({ ...promptForm, content: event.target.value })} rows="14" placeholder="Write the prompt template here..." /></label>
              <div className="admin-form-actions">
                <button className="btn" type="submit" disabled={saving}>Save New Version</button>
                <button className="btn btn-secondary" type="button" onClick={() => setPromptForm({ ...emptyPromptForm, subjectId: selectedSubjectId, promptType: selectedPromptType })}>Clear</button>
              </div>
            </form>
          </article>

          <article className="admin-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Active Versions</p>
                <h2>Rollback any version</h2>
              </div>
              <select value={selectedPromptType} onChange={(event) => setSelectedPromptType(event.target.value)}>
                <option value="system">System</option>
                <option value="interview">Interview</option>
                <option value="follow-up">Follow-up</option>
                <option value="evaluation">Evaluation</option>
                <option value="support">Support</option>
              </select>
            </div>
            <div className="admin-list">
              {filteredPrompts.filter((prompt) => prompt.prompt_type === selectedPromptType).map((prompt) => (
                <article className="admin-list-row stacked" key={prompt.id}>
                  <div>
                    <strong>Version {prompt.version_number}</strong>
                    <p>{prompt.is_active ? 'Active' : 'Archived'} • {prompt.subject_name}</p>
                  </div>
                  <p className="admin-snippet">{prompt.content}</p>
                  <div className="admin-row-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => setPromptForm({ id: prompt.id, subjectId: String(prompt.subject_id), promptType: prompt.prompt_type, content: prompt.content })}>Edit as new version</button>
                    {!prompt.is_active && <button className="btn" type="button" onClick={() => rollbackPrompt(prompt.id)} disabled={saving}>Rollback</button>}
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>
      )}

      {activeTab === 'materials' && (
        <section className="admin-panel-grid two-column">
          <article className="admin-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Study Material Management</p>
                <h2>{materialForm.id ? 'Edit material' : 'Add material'}</h2>
              </div>
            </div>
            <form className="admin-form" onSubmit={handleMaterialSubmit}>
              <label>Subject<select value={materialForm.subjectId || selectedSubjectId} onChange={(event) => setMaterialForm({ ...materialForm, subjectId: event.target.value })}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
              <label>Title<input value={materialForm.title} onChange={(event) => setMaterialForm({ ...materialForm, title: event.target.value })} /></label>
              <label>Material type<select value={materialForm.materialType} onChange={(event) => setMaterialForm({ ...materialForm, materialType: event.target.value })}><option value="pdf">PDF</option><option value="docx">DOCX</option><option value="ppt">PPT</option><option value="image">Image</option><option value="video-link">Video link</option><option value="website-link">Website link</option><option value="markdown">Markdown</option><option value="text">Text</option></select></label>
              <label>Tags<input value={materialForm.tags} onChange={(event) => setMaterialForm({ ...materialForm, tags: event.target.value })} placeholder="system design, sql, frontend" /></label>
              <label>Difficulty<select value={materialForm.difficulty} onChange={(event) => setMaterialForm({ ...materialForm, difficulty: event.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
              <label>Visibility<select value={materialForm.visibility} onChange={(event) => setMaterialForm({ ...materialForm, visibility: event.target.value })}><option value="private">Private</option><option value="internal">Internal</option><option value="public">Public</option></select></label>
              <label>Object storage key<input value={materialForm.storageKey} onChange={(event) => setMaterialForm({ ...materialForm, storageKey: event.target.value })} /></label>
              <label>Source URL<input value={materialForm.sourceUrl} onChange={(event) => setMaterialForm({ ...materialForm, sourceUrl: event.target.value })} /></label>
              <label>Mime type<input value={materialForm.mimeType} onChange={(event) => setMaterialForm({ ...materialForm, mimeType: event.target.value })} /></label>
              <label>Description<textarea value={materialForm.description} onChange={(event) => setMaterialForm({ ...materialForm, description: event.target.value })} rows="4" /></label>
              <label>Status<select value={materialForm.status} onChange={(event) => setMaterialForm({ ...materialForm, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option><option value="deleted">Deleted</option></select></label>
              <div className="admin-form-actions">
                <button className="btn" type="submit" disabled={saving}>Save Material</button>
                <button className="btn btn-secondary" type="button" onClick={() => setMaterialForm(emptyMaterialForm)}>Reset</button>
              </div>
            </form>
          </article>

          <article className="admin-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Stored Materials</p>
                <h2>Files and links</h2>
              </div>
            </div>
            <div className="admin-list">
              {filteredMaterials.map((material) => (
                <article className="admin-list-row stacked" key={material.id}>
                  <div>
                    <strong>{material.title}</strong>
                    <p>{material.subject_name} • {material.material_type} • {material.visibility}</p>
                  </div>
                  <p className="admin-snippet">{material.description}</p>
                  <div className="admin-row-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => editMaterial(material)}>Edit</button>
                    <button className="btn btn-danger" type="button" onClick={() => removeMaterial(material.id)} disabled={saving}>Archive</button>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>
      )}

      {activeTab === 'questions' && (
        <section className="admin-panel-grid two-column">
          <article className="admin-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Question Bank</p>
                <h2>{questionForm.id ? 'Edit question' : 'Add question'}</h2>
              </div>
            </div>
            <form className="admin-form" onSubmit={handleQuestionSubmit}>
              <label>Subject<select value={questionForm.subjectId || selectedSubjectId} onChange={(event) => setQuestionForm({ ...questionForm, subjectId: event.target.value })}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
              <label>Question<textarea value={questionForm.questionText} onChange={(event) => setQuestionForm({ ...questionForm, questionText: event.target.value })} rows="5" /></label>
              <label>Difficulty<select value={questionForm.difficulty} onChange={(event) => setQuestionForm({ ...questionForm, difficulty: event.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
              <label>Topic<input value={questionForm.topic} onChange={(event) => setQuestionForm({ ...questionForm, topic: event.target.value })} /></label>
              <label>Tags<input value={questionForm.tags} onChange={(event) => setQuestionForm({ ...questionForm, tags: event.target.value })} placeholder="arrays, hashmap, dp" /></label>
              <label>Answer hint<textarea value={questionForm.answerHint} onChange={(event) => setQuestionForm({ ...questionForm, answerHint: event.target.value })} rows="4" /></label>
              <label>Bulk source<input value={questionForm.bulkSource} onChange={(event) => setQuestionForm({ ...questionForm, bulkSource: event.target.value })} /></label>
              <label>Status<select value={questionForm.status} onChange={(event) => setQuestionForm({ ...questionForm, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option><option value="deleted">Deleted</option></select></label>
              <div className="admin-form-actions">
                <button className="btn" type="submit" disabled={saving}>Save Question</button>
                <button className="btn btn-secondary" type="button" onClick={() => setQuestionForm(emptyQuestionForm)}>Reset</button>
              </div>
            </form>
          </article>

          <article className="admin-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Bulk Import</p>
                <h2>Paste JSON array</h2>
              </div>
              <button className="btn btn-secondary" type="button" onClick={importQuestions} disabled={saving}>Import</button>
            </div>
            <textarea value={bulkQuestions} onChange={(event) => setBulkQuestions(event.target.value)} rows="10" spellCheck="false" />
            <div className="admin-list">
              {filteredQuestions.map((question) => (
                <article className="admin-list-row stacked" key={question.id}>
                  <div>
                    <strong>{question.question_text}</strong>
                    <p>{question.subject_name} • {question.topic || 'General'} • {question.difficulty}</p>
                  </div>
                  <div className="admin-row-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => editQuestion(question)}>Edit</button>
                    <button className="btn btn-danger" type="button" onClick={() => removeQuestion(question.id)} disabled={saving}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="admin-panel-grid two-column">
          <article className="admin-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Configuration</p>
                <h2>Interview controls</h2>
              </div>
            </div>
            <form className="admin-form" onSubmit={handleSettingsSubmit}>
              <label>Subject<select value={settingForm.subjectId || selectedSubjectId} onChange={(event) => setSettingForm({ ...settingForm, subjectId: event.target.value })}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
              <label>Max questions<input type="number" value={settingForm.maxQuestions} onChange={(event) => setSettingForm({ ...settingForm, maxQuestions: event.target.value })} /></label>
              <label>Time limit minutes<input type="number" value={settingForm.timeLimitMinutes} onChange={(event) => setSettingForm({ ...settingForm, timeLimitMinutes: event.target.value })} /></label>
              <label>Difficulty distribution<textarea value={settingForm.difficultyDistribution} onChange={(event) => setSettingForm({ ...settingForm, difficultyDistribution: event.target.value })} rows="6" /></label>
              <label>AI model<input value={settingForm.aiModel} onChange={(event) => setSettingForm({ ...settingForm, aiModel: event.target.value })} /></label>
              <label>Temperature<input type="number" step="0.01" value={settingForm.temperature} onChange={(event) => setSettingForm({ ...settingForm, temperature: event.target.value })} /></label>
              <label>Retrieval settings<textarea value={settingForm.retrievalSettings} onChange={(event) => setSettingForm({ ...settingForm, retrievalSettings: event.target.value })} rows="6" /></label>
              <button className="btn" type="submit" disabled={saving}>Save Settings</button>
            </form>
          </article>

          <article className="admin-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Live Config</p>
                <h2>Current subject settings</h2>
              </div>
            </div>
            {currentSettings ? (
              <div className="admin-code-block">
                <pre>{JSON.stringify(currentSettings, null, 2)}</pre>
              </div>
            ) : (
              <p className="empty-state inline-empty">No settings stored for this subject.</p>
            )}
          </article>
        </section>
      )}

      {activeTab === 'jobs' && (
        <section className="admin-panel-grid two-column">
          <article className="admin-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Background Jobs</p>
                <h2>Kafka queue view</h2>
              </div>
            </div>
            <div className="admin-list">
              {jobs.map((job) => (
                <article className="admin-list-row stacked" key={job.id}>
                  <div>
                    <strong>{job.job_type}</strong>
                    <p>{job.subject_name || 'Unassigned'} • {job.status} • attempts {job.attempts}</p>
                  </div>
                  <p className="admin-snippet">{job.related_entity_type || 'entity'} #{job.related_entity_id || '-'}</p>
                  {job.status === 'failed' && <button className="btn" type="button" onClick={() => retryJob(job.id)} disabled={saving}>Retry</button>}
                </article>
              ))}
            </div>
          </article>

          <article className="admin-panel">
            <div className="section-library-header">
              <div>
                <p className="eyebrow">Subject selector</p>
                <h2>Focus on one area</h2>
              </div>
            </div>
            <select value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)}>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
            <div className="admin-job-summary compact">
              <article><strong>{filteredPrompts.length}</strong><span>Prompts</span></article>
              <article><strong>{filteredMaterials.length}</strong><span>Materials</span></article>
              <article><strong>{filteredQuestions.length}</strong><span>Questions</span></article>
            </div>
          </article>
        </section>
      )}
    </div>
  );
};

export default AdminDashboard;