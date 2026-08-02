const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const PROMPT_TYPES = ['system', 'interview', 'follow-up', 'evaluation', 'support'];
const MATERIAL_TYPES = ['pdf', 'docx', 'ppt', 'image', 'video-link', 'website-link', 'markdown', 'text'];
const VISIBILITIES = ['public', 'internal', 'private'];
const JOB_STATUSES = ['pending', 'processing', 'completed', 'failed'];
const SUBJECT_STATUSES = ['active', 'inactive'];

const parseJson = (value, fallback) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const parseTags = (value) => {
  const parsed = parseJson(value, []);
  if (Array.isArray(parsed)) {
    return parsed.filter(Boolean).map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof parsed === 'string') {
    return parsed.split(',').map((tag) => tag.trim()).filter(Boolean);
  }

  return [];
};

const slugify = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const withAdminAccess = [authMiddleware, async (req, res, next) => {
  try {
    const userResult = await pool.query('SELECT id, role, status FROM users WHERE id = $1', [req.user.id]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found.' });
    }

    const user = userResult.rows[0];
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is inactive.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    return next();
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: 'Unable to verify admin access.' });
  }
}];

router.use(...withAdminAccess);

router.get('/summary', async (req, res) => {
  try {
    const [usersCount, interviewsCount, subjectsCount, materialsCount, jobsCount, recentUploads, jobStatusCounts] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total_users FROM users'),
      pool.query('SELECT COUNT(*)::int AS total_interviews FROM interviews'),
      pool.query("SELECT COUNT(*)::int AS active_subjects FROM subjects WHERE status = 'active'"),
      pool.query("SELECT COUNT(*)::int AS uploaded_materials FROM study_materials WHERE status <> 'deleted'"),
      pool.query('SELECT status, COUNT(*)::int AS total FROM admin_jobs GROUP BY status'),
      pool.query(`
        SELECT m.id, m.title, m.material_type, m.job_status, m.created_at, s.name AS subject_name
        FROM study_materials m
        JOIN subjects s ON s.id = m.subject_id
        ORDER BY m.created_at DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT status, COUNT(*)::int AS total
        FROM admin_jobs
        GROUP BY status
      `)
    ]);

    res.json({
      totals: {
        users: usersCount.rows[0].total_users,
        interviews: interviewsCount.rows[0].total_interviews,
        activeSubjects: subjectsCount.rows[0].active_subjects,
        materials: materialsCount.rows[0].uploaded_materials,
        jobs: jobsCount.rows.reduce((sum, row) => sum + row.total, 0)
      },
      recentUploads: recentUploads.rows,
      jobStatusCounts: jobStatusCounts.rows.reduce((accumulator, row) => {
        accumulator[row.status] = row.total;
        return accumulator;
      }, { pending: 0, processing: 0, completed: 0, failed: 0 })
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to load admin summary.' });
  }
});

router.get('/subjects', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.*,
        COALESCE(settings.max_questions, 0) AS max_questions,
        COALESCE(settings.time_limit_minutes, 0) AS time_limit_minutes,
        COALESCE(settings.ai_model, 'gpt-5.4-mini') AS ai_model,
        COALESCE(settings.temperature, 0.70) AS temperature,
        COALESCE(settings.difficulty_distribution, '{}'::jsonb) AS difficulty_distribution,
        COALESCE(settings.retrieval_settings, '{}'::jsonb) AS retrieval_settings,
        COALESCE(prompt_counts.total_prompts, 0) AS total_prompts,
        COALESCE(material_counts.total_materials, 0) AS total_materials,
        COALESCE(question_counts.total_questions, 0) AS total_questions
      FROM subjects s
      LEFT JOIN subject_settings settings ON settings.subject_id = s.id
      LEFT JOIN (
        SELECT subject_id, COUNT(*)::int AS total_prompts
        FROM subject_prompt_versions
        GROUP BY subject_id
      ) prompt_counts ON prompt_counts.subject_id = s.id
      LEFT JOIN (
        SELECT subject_id, COUNT(*)::int AS total_materials
        FROM study_materials
        WHERE status <> 'deleted'
        GROUP BY subject_id
      ) material_counts ON material_counts.subject_id = s.id
      LEFT JOIN (
        SELECT subject_id, COUNT(*)::int AS total_questions
        FROM question_bank
        WHERE status <> 'deleted'
        GROUP BY subject_id
      ) question_counts ON question_counts.subject_id = s.id
      ORDER BY s.display_order ASC, s.name ASC
    `);

    res.json({ subjects: result.rows });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to load subjects.' });
  }
});

router.post('/subjects', async (req, res) => {
  const {
    name,
    slug,
    description = '',
    icon = '',
    displayOrder = 0,
    difficulties = ['Beginner', 'Intermediate', 'Advanced'],
    status = 'active'
  } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Subject name is required.' });
  }

  if (!SUBJECT_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid subject status.' });
  }

  const nextSlug = slugify(slug || name);

  try {
    const result = await pool.query(
      `
        INSERT INTO subjects (slug, name, description, icon, display_order, difficulties, status)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        RETURNING *
      `,
      [nextSlug, name, description, icon, toInteger(displayOrder), JSON.stringify(parseJson(difficulties, [])), status]
    );

    await pool.query(
      `
        INSERT INTO subject_settings (subject_id)
        VALUES ($1)
        ON CONFLICT (subject_id) DO NOTHING
      `,
      [result.rows[0].id]
    );

    res.status(201).json({ subject: result.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to create subject.' });
  }
});

router.put('/subjects/:id', async (req, res) => {
  const subjectId = toInteger(req.params.id);
  const {
    name,
    slug,
    description = '',
    icon = '',
    displayOrder = 0,
    difficulties = ['Beginner', 'Intermediate', 'Advanced'],
    status = 'active'
  } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Subject name is required.' });
  }

  if (!SUBJECT_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid subject status.' });
  }

  try {
    const result = await pool.query(
      `
        UPDATE subjects
        SET slug = $1, name = $2, description = $3, icon = $4, display_order = $5, difficulties = $6::jsonb, status = $7, updated_at = NOW()
        WHERE id = $8
        RETURNING *
      `,
      [slugify(slug || name), name, description, icon, toInteger(displayOrder), JSON.stringify(parseJson(difficulties, [])), status, subjectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    res.json({ subject: result.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to update subject.' });
  }
});

router.delete('/subjects/:id', async (req, res) => {
  const subjectId = toInteger(req.params.id);

  try {
    const result = await pool.query(
      `
        UPDATE subjects
        SET status = 'inactive', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [subjectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    res.json({ subject: result.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to delete subject.' });
  }
});

router.get('/prompts', async (req, res) => {
  const subjectId = req.query.subjectId ? toInteger(req.query.subjectId) : null;
  const promptType = req.query.promptType || null;

  try {
    const filters = [];
    const values = [];

    if (subjectId) {
      values.push(subjectId);
      filters.push(`subject_id = $${values.length}`);
    }

    if (promptType) {
      values.push(promptType);
      filters.push(`prompt_type = $${values.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await pool.query(`
      SELECT p.*, s.name AS subject_name, s.slug AS subject_slug
      FROM subject_prompt_versions p
      JOIN subjects s ON s.id = p.subject_id
      ${whereClause}
      ORDER BY p.subject_id ASC, p.prompt_type ASC, p.version_number DESC
    `, values);

    res.json({ prompts: result.rows });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to load prompts.' });
  }
});

router.post('/prompts', async (req, res) => {
  const { subjectId, promptType, content } = req.body;
  const nextSubjectId = toInteger(subjectId);

  if (!nextSubjectId || !PROMPT_TYPES.includes(promptType)) {
    return res.status(400).json({ message: 'Subject and prompt type are required.' });
  }

  if (!content || !content.trim()) {
    return res.status(400).json({ message: 'Prompt content is required.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const versionResult = await client.query(
      `
        SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
        FROM subject_prompt_versions
        WHERE subject_id = $1 AND prompt_type = $2
      `,
      [nextSubjectId, promptType]
    );

    await client.query(
      `
        UPDATE subject_prompt_versions
        SET is_active = FALSE, updated_at = NOW()
        WHERE subject_id = $1 AND prompt_type = $2
      `,
      [nextSubjectId, promptType]
    );

    const result = await client.query(
      `
        INSERT INTO subject_prompt_versions (subject_id, prompt_type, version_number, content, is_active, created_by)
        VALUES ($1, $2, $3, $4, TRUE, $5)
        RETURNING *
      `,
      [nextSubjectId, promptType, versionResult.rows[0].next_version, content.trim(), req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ prompt: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error.message);
    res.status(500).json({ message: 'Unable to save prompt version.' });
  } finally {
    client.release();
  }
});

router.post('/prompts/:id/rollback', async (req, res) => {
  const promptId = toInteger(req.params.id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const promptResult = await client.query(
      'SELECT id, subject_id, prompt_type FROM subject_prompt_versions WHERE id = $1',
      [promptId]
    );

    if (promptResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Prompt version not found.' });
    }

    const prompt = promptResult.rows[0];

    await client.query(
      `
        UPDATE subject_prompt_versions
        SET is_active = FALSE, updated_at = NOW()
        WHERE subject_id = $1 AND prompt_type = $2
      `,
      [prompt.subject_id, prompt.prompt_type]
    );

    const result = await client.query(
      `
        UPDATE subject_prompt_versions
        SET is_active = TRUE, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [promptId]
    );

    await client.query('COMMIT');
    res.json({ prompt: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error.message);
    res.status(500).json({ message: 'Unable to rollback prompt version.' });
  } finally {
    client.release();
  }
});

router.get('/materials', async (req, res) => {
  const subjectId = req.query.subjectId ? toInteger(req.query.subjectId) : null;

  try {
    const values = [];
    const filters = ["m.status <> 'deleted'"];

    if (subjectId) {
      values.push(subjectId);
      filters.push(`m.subject_id = $${values.length}`);
    }

    const result = await pool.query(`
      SELECT m.*, s.name AS subject_name, s.slug AS subject_slug
      FROM study_materials m
      JOIN subjects s ON s.id = m.subject_id
      WHERE ${filters.join(' AND ')}
      ORDER BY m.created_at DESC
    `, values);

    res.json({ materials: result.rows });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to load study materials.' });
  }
});

router.post('/materials', async (req, res) => {
  const {
    subjectId,
    title,
    description = '',
    materialType,
    tags = [],
    difficulty = 'Intermediate',
    visibility = 'private',
    storageKey = '',
    sourceUrl = '',
    mimeType = ''
  } = req.body;

  if (!subjectId || !title || !materialType) {
    return res.status(400).json({ message: 'Subject, title, and material type are required.' });
  }

  if (!MATERIAL_TYPES.includes(materialType)) {
    return res.status(400).json({ message: 'Unsupported material type.' });
  }

  if (!VISIBILITIES.includes(visibility)) {
    return res.status(400).json({ message: 'Invalid visibility.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const materialResult = await client.query(
      `
        INSERT INTO study_materials (
          subject_id, title, description, material_type, tags, difficulty, visibility, storage_key, source_url, mime_type, status, job_status, embedding_status
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, 'active', 'pending', 'pending')
        RETURNING *
      `,
      [
        toInteger(subjectId),
        title,
        description,
        materialType,
        JSON.stringify(parseTags(tags)),
        difficulty,
        visibility,
        storageKey,
        sourceUrl,
        mimeType
      ]
    );

    const jobResult = await client.query(
      `
        INSERT INTO admin_jobs (job_type, status, related_entity_type, related_entity_id, payload)
        VALUES ('material-processing', 'pending', 'study_material', $1, $2::jsonb)
        RETURNING *
      `,
      [
        materialResult.rows[0].id,
        JSON.stringify({ subjectId: toInteger(subjectId), storageKey, sourceUrl, mimeType, materialType })
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({ material: materialResult.rows[0], job: jobResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error.message);
    res.status(500).json({ message: 'Unable to create material.' });
  } finally {
    client.release();
  }
});

router.put('/materials/:id', async (req, res) => {
  const materialId = toInteger(req.params.id);
  const {
    subjectId,
    title,
    description = '',
    materialType,
    tags = [],
    difficulty = 'Intermediate',
    visibility = 'private',
    storageKey = '',
    sourceUrl = '',
    mimeType = '',
    status = 'active',
    jobStatus = 'pending',
    embeddingStatus = 'pending'
  } = req.body;

  if (!title || !materialType) {
    return res.status(400).json({ message: 'Title and material type are required.' });
  }

  if (!MATERIAL_TYPES.includes(materialType)) {
    return res.status(400).json({ message: 'Unsupported material type.' });
  }

  if (!VISIBILITIES.includes(visibility)) {
    return res.status(400).json({ message: 'Invalid visibility.' });
  }

  try {
    const result = await pool.query(
      `
        UPDATE study_materials
        SET subject_id = COALESCE($1, subject_id),
            title = $2,
            description = $3,
            material_type = $4,
            tags = $5::jsonb,
            difficulty = $6,
            visibility = $7,
            storage_key = $8,
            source_url = $9,
            mime_type = $10,
            status = $11,
            job_status = $12,
            embedding_status = $13,
            updated_at = NOW()
        WHERE id = $14
        RETURNING *
      `,
      [
        subjectId ? toInteger(subjectId) : null,
        title,
        description,
        materialType,
        JSON.stringify(parseTags(tags)),
        difficulty,
        visibility,
        storageKey,
        sourceUrl,
        mimeType,
        status,
        jobStatus,
        embeddingStatus,
        materialId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Material not found.' });
    }

    res.json({ material: result.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to update material.' });
  }
});

router.delete('/materials/:id', async (req, res) => {
  const materialId = toInteger(req.params.id);

  try {
    const result = await pool.query(
      `
        UPDATE study_materials
        SET status = 'deleted', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [materialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Material not found.' });
    }

    res.json({ material: result.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to delete material.' });
  }
});

router.get('/questions', async (req, res) => {
  const subjectId = req.query.subjectId ? toInteger(req.query.subjectId) : null;

  try {
    const values = [];
    const filters = ["status <> 'deleted'"];

    if (subjectId) {
      values.push(subjectId);
      filters.push(`subject_id = $${values.length}`);
    }

    const result = await pool.query(`
      SELECT q.*, s.name AS subject_name, s.slug AS subject_slug
      FROM question_bank q
      JOIN subjects s ON s.id = q.subject_id
      WHERE ${filters.join(' AND ')}
      ORDER BY q.created_at DESC
    `, values);

    res.json({ questions: result.rows });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to load questions.' });
  }
});

router.post('/questions', async (req, res) => {
  const {
    subjectId,
    questionText,
    difficulty = 'Intermediate',
    topic = '',
    tags = [],
    answerHint = '',
    status = 'active',
    bulkSource = 'admin'
  } = req.body;

  if (!subjectId || !questionText) {
    return res.status(400).json({ message: 'Subject and question text are required.' });
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO question_bank (subject_id, question_text, difficulty, topic, tags, answer_hint, status, bulk_source)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
        RETURNING *
      `,
      [
        toInteger(subjectId),
        questionText,
        difficulty,
        topic,
        JSON.stringify(parseTags(tags)),
        answerHint,
        status,
        bulkSource
      ]
    );

    res.status(201).json({ question: result.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to create question.' });
  }
});

router.put('/questions/:id', async (req, res) => {
  const questionId = toInteger(req.params.id);
  const {
    subjectId,
    questionText,
    difficulty = 'Intermediate',
    topic = '',
    tags = [],
    answerHint = '',
    status = 'active',
    bulkSource = 'admin'
  } = req.body;

  if (!questionText) {
    return res.status(400).json({ message: 'Question text is required.' });
  }

  try {
    const result = await pool.query(
      `
        UPDATE question_bank
        SET subject_id = COALESCE($1, subject_id),
            question_text = $2,
            difficulty = $3,
            topic = $4,
            tags = $5::jsonb,
            answer_hint = $6,
            status = $7,
            bulk_source = $8,
            updated_at = NOW()
        WHERE id = $9
        RETURNING *
      `,
      [
        subjectId ? toInteger(subjectId) : null,
        questionText,
        difficulty,
        topic,
        JSON.stringify(parseTags(tags)),
        answerHint,
        status,
        bulkSource,
        questionId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Question not found.' });
    }

    res.json({ question: result.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to update question.' });
  }
});

router.delete('/questions/:id', async (req, res) => {
  const questionId = toInteger(req.params.id);

  try {
    const result = await pool.query(
      `
        UPDATE question_bank
        SET status = 'deleted', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [questionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Question not found.' });
    }

    res.json({ question: result.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to delete question.' });
  }
});

router.post('/questions/import', async (req, res) => {
  const { questions } = req.body;

  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ message: 'Provide an array of questions to import.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const imported = [];

    for (const question of questions) {
      if (!question.subjectId || !question.questionText) {
        continue;
      }

      const result = await client.query(
        `
          INSERT INTO question_bank (subject_id, question_text, difficulty, topic, tags, answer_hint, status, bulk_source)
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
          RETURNING *
        `,
        [
          toInteger(question.subjectId),
          question.questionText,
          question.difficulty || 'Intermediate',
          question.topic || '',
          JSON.stringify(parseTags(question.tags)),
          question.answerHint || '',
          question.status || 'active',
          question.bulkSource || 'bulk-import'
        ]
      );

      imported.push(result.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ importedCount: imported.length, questions: imported });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error.message);
    res.status(500).json({ message: 'Unable to import questions.' });
  } finally {
    client.release();
  }
});

router.get('/settings', async (req, res) => {
  const subjectId = req.query.subjectId ? toInteger(req.query.subjectId) : null;

  try {
    const values = [];
    const filters = [];

    if (subjectId) {
      values.push(subjectId);
      filters.push(`subject_id = $${values.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await pool.query(`
      SELECT settings.*, s.name AS subject_name, s.slug AS subject_slug
      FROM subject_settings settings
      JOIN subjects s ON s.id = settings.subject_id
      ${whereClause}
      ORDER BY s.display_order ASC
    `, values);

    res.json({ settings: result.rows });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to load settings.' });
  }
});

router.put('/settings/:subjectId', async (req, res) => {
  const subjectId = toInteger(req.params.subjectId);
  const {
    maxQuestions = 5,
    timeLimitMinutes = 30,
    difficultyDistribution = {},
    aiModel = 'gpt-5.4-mini',
    temperature = 0.7,
    retrievalSettings = {}
  } = req.body;

  try {
    const result = await pool.query(
      `
        INSERT INTO subject_settings (subject_id, max_questions, time_limit_minutes, difficulty_distribution, ai_model, temperature, retrieval_settings, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, NOW())
        ON CONFLICT (subject_id)
        DO UPDATE SET
          max_questions = EXCLUDED.max_questions,
          time_limit_minutes = EXCLUDED.time_limit_minutes,
          difficulty_distribution = EXCLUDED.difficulty_distribution,
          ai_model = EXCLUDED.ai_model,
          temperature = EXCLUDED.temperature,
          retrieval_settings = EXCLUDED.retrieval_settings,
          updated_at = NOW()
        RETURNING *
      `,
      [
        subjectId,
        toInteger(maxQuestions, 5),
        toInteger(timeLimitMinutes, 30),
        JSON.stringify(parseJson(difficultyDistribution, {})),
        aiModel,
        Number.isFinite(Number(temperature)) ? Number(temperature) : 0.7,
        JSON.stringify(parseJson(retrievalSettings, {}))
      ]
    );

    res.json({ setting: result.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to update settings.' });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT j.*, s.name AS subject_name, m.title AS material_title
      FROM admin_jobs j
      LEFT JOIN study_materials m ON m.id = j.related_entity_id AND j.related_entity_type = 'study_material'
      LEFT JOIN subjects s ON s.id = m.subject_id
      ORDER BY j.created_at DESC
    `);

    res.json({ jobs: result.rows });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to load jobs.' });
  }
});

router.post('/jobs/:id/retry', async (req, res) => {
  const jobId = toInteger(req.params.id);

  try {
    const result = await pool.query(
      `
        UPDATE admin_jobs
        SET status = 'pending',
            attempts = attempts + 1,
            last_error = NULL,
            updated_at = NOW(),
            completed_at = NULL
        WHERE id = $1
        RETURNING *
      `,
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    res.json({ job: result.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Unable to retry job.' });
  }
});

module.exports = router;