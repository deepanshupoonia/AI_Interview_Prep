const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

pool.query(`
  CREATE TABLE IF NOT EXISTS resumes (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120),
    file_data BYTEA,
    raw_text TEXT,
    parsed JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).catch((err) => {
  console.error(`Unable to ensure resumes table: ${err.message}`);
});

const execFileAsync = (file, args, options = {}) => new Promise((resolve) => {
  execFile(file, args, { timeout: 10000, windowsHide: true, ...options }, (error, stdout, stderr) => {
    resolve({ ok: !error, stdout: String(stdout || ''), stderr: String(stderr || ''), error });
  });
});

const normalizeLines = (text) => String(text || '')
  .replace(/\r/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const decodeBase64File = (value) => {
  const base64 = String(value || '').replace(/^data:[^;]+;base64,/, '');
  return Buffer.from(base64, 'base64');
};

const extractPdfText = (buffer) => {
  const text = buffer.toString('latin1');
  const chunks = [];
  const literalMatches = text.matchAll(/\(([^()]{2,})\)\s*Tj/g);
  const arrayMatches = text.matchAll(/\[((?:\([^()]*\)\s*)+)\]\s*TJ/g);

  for (const match of literalMatches) {
    chunks.push(match[1]);
  }

  for (const match of arrayMatches) {
    chunks.push(...Array.from(match[1].matchAll(/\(([^()]*)\)/g)).map((item) => item[1]));
  }

  return normalizeLines(chunks.join(' ')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')'));
};

const extractDocxText = async (buffer) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-docx-'));
  const filePath = path.join(tempDir, 'resume.docx');

  try {
    fs.writeFileSync(filePath, buffer);
    const command = `
Add-Type -AssemblyName System.IO.Compression.FileSystem;
$zip = [System.IO.Compression.ZipFile]::OpenRead('${filePath.replace(/'/g, "''")}');
$entry = $zip.GetEntry('word/document.xml');
$reader = New-Object System.IO.StreamReader($entry.Open());
$xml = $reader.ReadToEnd();
$reader.Close();
$zip.Dispose();
$text = [regex]::Replace($xml, '<[^>]+>', ' ');
$text = [System.Net.WebUtility]::HtmlDecode($text);
$text = [regex]::Replace($text, '\\s+', ' ').Trim();
Write-Output $text;
`;
    const result = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command]);
    return result.ok ? normalizeLines(result.stdout) : '';
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const extractResumeText = async ({ buffer, fileName, mimeType }) => {
  const lowerName = String(fileName || '').toLowerCase();

  if (lowerName.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractDocxText(buffer);
  }

  if (lowerName.endsWith('.pdf') || mimeType === 'application/pdf') {
    return extractPdfText(buffer);
  }

  return normalizeLines(buffer.toString('utf8'));
};

const sectionAliases = {
  education: ['education', 'academic background', 'academics'],
  skills: ['skills', 'technical skills', 'technologies', 'tools'],
  projects: ['projects', 'academic projects', 'personal projects'],
  experience: ['experience', 'work experience', 'internship', 'internships', 'professional experience'],
  achievements: ['achievements', 'awards', 'certifications', 'accomplishments']
};

const allHeadings = Object.values(sectionAliases).flat();

const findSection = (text, aliases) => {
  const lower = text.toLowerCase();
  const starts = aliases
    .map((alias) => {
      const match = lower.match(new RegExp(`(^|\\n)\\s*${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?`, 'i'));
      return match ? { index: match.index + match[0].length, alias } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);

  if (!starts.length) return '';

  const start = starts[0].index;
  const endCandidates = allHeadings
    .filter((heading) => !aliases.includes(heading))
    .map((heading) => {
      const match = lower.slice(start).match(new RegExp(`\\n\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?`, 'i'));
      return match ? start + match.index : null;
    })
    .filter((index) => index !== null);
  const end = endCandidates.length ? Math.min(...endCandidates) : text.length;

  return text.slice(start, end);
};

const splitItems = (sectionText) => normalizeLines(sectionText)
  .split(/\n|•|- |\u2022|;|\|/)
  .map((item) => item.trim())
  .filter((item) => item.length > 2)
  .slice(0, 18);

const inferSkills = (text) => {
  const known = ['Java', 'Python', 'C++', 'C', 'JavaScript', 'React', 'Node', 'Express', 'SQL', 'PostgreSQL', 'MongoDB', 'HTML', 'CSS', 'AWS', 'Docker', 'Git', 'Machine Learning', 'DSA', 'Operating Systems', 'DBMS', 'OOP'];
  const lower = text.toLowerCase();
  return known.filter((skill) => lower.includes(skill.toLowerCase()));
};

const parseResumeText = (text) => {
  const normalized = normalizeLines(text);
  const parsed = {
    education: splitItems(findSection(normalized, sectionAliases.education)),
    skills: splitItems(findSection(normalized, sectionAliases.skills)),
    projects: splitItems(findSection(normalized, sectionAliases.projects)),
    experience: splitItems(findSection(normalized, sectionAliases.experience)),
    achievements: splitItems(findSection(normalized, sectionAliases.achievements))
  };

  if (parsed.skills.length === 0) {
    parsed.skills = inferSkills(normalized);
  }

  return parsed;
};

const serializeResume = (row) => row ? ({
  id: row.id,
  fileName: row.file_name,
  mimeType: row.mime_type,
  parsed: row.parsed || {},
  rawText: row.raw_text || '',
  updatedAt: row.updated_at,
  createdAt: row.created_at
}) : null;

router.get('/', authMiddleware, async (req, res) => {
  const result = await pool.query('SELECT * FROM resumes WHERE user_id = $1', [req.user.id]);
  res.json({ resume: serializeResume(result.rows[0]) });
});

router.post('/parse', authMiddleware, async (req, res) => {
  const { fileName, mimeType, dataBase64 } = req.body;
  const lowerName = String(fileName || '').toLowerCase();

  if (!lowerName.endsWith('.pdf') && !lowerName.endsWith('.docx')) {
    return res.status(400).json({ message: 'Upload a PDF or DOCX resume.' });
  }

  const buffer = decodeBase64File(dataBase64);
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
    return res.status(400).json({ message: 'Resume file must be under 8 MB.' });
  }

  const rawText = await extractResumeText({ buffer, fileName, mimeType });
  const parsed = parseResumeText(rawText);

  res.json({ fileName, mimeType, rawText, parsed });
});

router.post('/', authMiddleware, async (req, res) => {
  const { fileName, mimeType, dataBase64, rawText, parsed } = req.body;
  const buffer = dataBase64 ? decodeBase64File(dataBase64) : null;

  const result = await pool.query(
    `INSERT INTO resumes (user_id, file_name, mime_type, file_data, raw_text, parsed, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET file_name = EXCLUDED.file_name,
       mime_type = EXCLUDED.mime_type,
       file_data = EXCLUDED.file_data,
       raw_text = EXCLUDED.raw_text,
       parsed = EXCLUDED.parsed,
       updated_at = NOW()
     RETURNING *`,
    [req.user.id, fileName, mimeType, buffer, rawText || '', JSON.stringify(parsed || {})]
  );

  res.json({ resume: serializeResume(result.rows[0]) });
});

router.put('/', authMiddleware, async (req, res) => {
  const { parsed, rawText } = req.body;
  const result = await pool.query(
    `UPDATE resumes
     SET parsed = $1, raw_text = COALESCE($2, raw_text), updated_at = NOW()
     WHERE user_id = $3
     RETURNING *`,
    [JSON.stringify(parsed || {}), rawText || null, req.user.id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ message: 'No resume saved yet.' });
  }

  res.json({ resume: serializeResume(result.rows[0]) });
});

router.delete('/', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM resumes WHERE user_id = $1', [req.user.id]);
  res.json({ message: 'Resume removed.' });
});

module.exports = router;
