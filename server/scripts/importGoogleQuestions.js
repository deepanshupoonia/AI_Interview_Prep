const fs = require('fs');
const https = require('https');
const path = require('path');
const pool = require('../db');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CSV_PATH = process.env.CSV_PATH || path.join(DATA_DIR, 'google_1year.csv');
const CSV_URL = process.env.CSV_URL;
const COMPANY = process.env.COMPANY || 'Google';

const COMPANY_TABLES = {
  Amazon: 'amazon_questions',
  Arista: 'arista_questions',
  Google: 'google_questions'
};

const BUNDLED_IMPORTS = [
  { company: 'Amazon', csvPath: path.join(DATA_DIR, 'amazon_alltime.csv') },
  { company: 'Arista', csvPath: path.join(DATA_DIR, 'arista_alltime.csv') },
  { company: 'Google', csvPath: path.join(DATA_DIR, 'google_1year.csv') }
];

const readCsv = (csvPath = CSV_PATH) => new Promise((resolve, reject) => {
  if (!CSV_URL) {
    resolve(fs.readFileSync(csvPath, 'utf8'));
    return;
  }

  https.get(CSV_URL, (response) => {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      reject(new Error(`CSV download failed with status ${response.statusCode}`));
      response.resume();
      return;
    }

    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      body += chunk;
    });
    response.on('end', () => resolve(body));
  }).on('error', reject);
});

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

const renameLegacyCompanyTable = async () => {
  const existingColumns = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'leetcode_questions'
    `
  );
  const columnNames = existingColumns.rows.map((row) => row.column_name);

  if (columnNames.includes('company')) {
    await pool.query(`ALTER TABLE leetcode_questions RENAME TO leetcode_questions_legacy_${Date.now()}`);
  }
};

const ensureLeetcodeTables = async () => {
  await renameLegacyCompanyTable();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leetcode_questions (
      id SERIAL PRIMARY KEY,
      leetcode_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      acceptance VARCHAR(20),
      difficulty VARCHAR(20),
      problem_url TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(leetcode_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_leetcode_questions_leetcode_id
    ON leetcode_questions(leetcode_id)
  `);

  for (const tableName of Object.values(COMPANY_TABLES)) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        question_id INT PRIMARY KEY REFERENCES leetcode_questions(id) ON DELETE CASCADE,
        priority_order INT NOT NULL,
        frequency DECIMAL(12, 8),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }
};

const importQuestions = async ({ company = COMPANY, csvPath = CSV_PATH } = {}) => {
  const tableName = COMPANY_TABLES[company];

  if (!tableName) {
    throw new Error(`Unsupported company "${company}". Add it to COMPANY_TABLES before importing.`);
  }

  const csv = (await readCsv(csvPath)).trim();
  const lines = csv.split(/\r?\n/);
  const rows = lines.slice(1);

  for (const [index, line] of rows.entries()) {
    if (!line.trim()) continue;

    const [leetcodeId, title, acceptance, difficulty, frequency, problemUrl] = parseCsvLine(line);
    const questionResult = await pool.query(
      `
        INSERT INTO leetcode_questions (
          leetcode_id,
          title,
          acceptance,
          difficulty,
          problem_url,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (leetcode_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          acceptance = EXCLUDED.acceptance,
          difficulty = EXCLUDED.difficulty,
          problem_url = EXCLUDED.problem_url,
          updated_at = NOW()
        RETURNING id
      `,
      [
        Number(leetcodeId),
        title,
        acceptance,
        difficulty,
        problemUrl.trim()
      ]
    );

    await pool.query(
      `
        INSERT INTO ${tableName} (
          question_id,
          priority_order,
          frequency,
          updated_at
        )
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (question_id)
        DO UPDATE SET
          priority_order = EXCLUDED.priority_order,
          frequency = EXCLUDED.frequency,
          updated_at = NOW()
      `,
      [
        questionResult.rows[0].id,
        index + 1,
        Number(frequency)
      ]
    );
  }

  console.log(`Imported ${rows.length} ${company} LeetCode questions.`);
};

const run = async () => {
  await ensureLeetcodeTables();

  if (process.env.CSV_URL || process.env.CSV_PATH || process.env.COMPANY) {
    await importQuestions();
  } else {
    for (const importConfig of BUNDLED_IMPORTS) {
      await importQuestions(importConfig);
    }
  }

  await pool.end();
};

run().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
