const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { seedAllCompanies } = require('../scripts/importGoogleQuestions');

const router = express.Router();

let seedPromise = null;

const ensureDsaSeeded = async () => {
  if (!seedPromise) {
    seedPromise = seedAllCompanies().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }

  return seedPromise;
};

const COMPANY_QUERIES = [
  { company: 'Google', tableName: 'google_questions' },
  { company: 'Arista', tableName: 'arista_questions' },
  { company: 'Amazon', tableName: 'amazon_questions' },
  { company: 'Flipkart', tableName: 'flipkart_questions' },
  { company: 'Apple', tableName: 'apple_questions' },
  { company: 'Meesho', tableName: 'meesho_questions' },
  { company: 'Intel', tableName: 'intel_questions' },
  { company: 'Nvidia', tableName: 'nvidia_questions' },
  { company: 'Salesforce', tableName: 'salesforce_questions' }
];

router.get('/questions', authMiddleware, async (req, res) => {
  try {
    await ensureDsaSeeded().catch((error) => {
      console.warn(`DSA seed warmup failed: ${error.message}`);
    });

    const companySelects = COMPANY_QUERIES.map(({ company, tableName }) => `
      SELECT
        '${company}' AS company,
        cq.priority_order,
        q.leetcode_id,
        q.title,
        q.acceptance,
        q.difficulty,
        cq.frequency,
        q.problem_url
      FROM ${tableName} cq
      JOIN leetcode_questions q ON q.id = cq.question_id
    `).join('\nUNION ALL\n');

    const questionsResult = await pool.query(
      `
        ${companySelects}
        ORDER BY company ASC, priority_order ASC
      `
    );

    const companies = COMPANY_QUERIES.map(({ company }) => ({
      company,
      total_questions: questionsResult.rows.filter((question) => question.company === company).length
    }));

    res.json({
      questions: questionsResult.rows,
      companies
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Unable to load DSA questions. Check that the LeetCode seed has been imported.' });
  }
});

module.exports = router;
