const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const COMPANY_QUERIES = [
  { company: 'Google', tableName: 'google_questions' },
  { company: 'Arista', tableName: 'arista_questions' },
  { company: 'Amazon', tableName: 'amazon_questions' }
];

router.get('/questions', authMiddleware, async (req, res) => {
  try {
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
