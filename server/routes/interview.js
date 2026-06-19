const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const SUBJECT_LIMITS = {
  OOP: { label: 'Object Oriented Programming', min: 0, max: 10 },
  OS: { label: 'Operating Systems', min: 0, max: 10 },
  DBMS: { label: 'Database Management Systems', min: 0, max: 10 },
  DSA: { label: 'Data Structures and Algorithms', min: 0, max: 5 }
};

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const sessions = new Map();

const QUESTION_BANK = {
  OOP: [
    {
      prompt: 'Explain encapsulation with a practical example from a real application.',
      keywords: ['encapsulation', 'data', 'private', 'public', 'class', 'method', 'state', 'example']
    },
    {
      prompt: 'How is abstraction different from encapsulation?',
      keywords: ['abstraction', 'encapsulation', 'hide', 'implementation', 'interface', 'details']
    },
    {
      prompt: 'What is polymorphism, and how do method overloading and overriding differ?',
      keywords: ['polymorphism', 'overloading', 'overriding', 'compile', 'runtime', 'inheritance']
    },
    {
      prompt: 'When would you prefer composition over inheritance?',
      keywords: ['composition', 'inheritance', 'flexibility', 'coupling', 'reuse', 'has-a', 'is-a']
    },
    {
      prompt: 'What does the SOLID single responsibility principle mean?',
      keywords: ['solid', 'single', 'responsibility', 'class', 'change', 'cohesion']
    },
    {
      prompt: 'Explain dependency inversion with a short design example.',
      keywords: ['dependency', 'inversion', 'interface', 'abstraction', 'module', 'implementation']
    },
    {
      prompt: 'What is constructor chaining and why can it be useful?',
      keywords: ['constructor', 'chaining', 'initialization', 'reuse', 'super', 'this']
    },
    {
      prompt: 'How do access modifiers support maintainable object oriented design?',
      keywords: ['access', 'private', 'protected', 'public', 'maintainable', 'encapsulation']
    },
    {
      prompt: 'What is an interface, and how is it different from an abstract class?',
      keywords: ['interface', 'abstract', 'contract', 'implementation', 'inheritance', 'methods']
    },
    {
      prompt: 'Describe a design pattern you have used and the problem it solved.',
      keywords: ['pattern', 'factory', 'singleton', 'observer', 'strategy', 'problem', 'design']
    }
  ],
  OS: [
    {
      prompt: 'What happens when a process changes from running to waiting state?',
      keywords: ['process', 'state', 'running', 'waiting', 'scheduler', 'io', 'cpu']
    },
    {
      prompt: 'Explain the difference between a process and a thread.',
      keywords: ['process', 'thread', 'memory', 'address', 'stack', 'context', 'overhead']
    },
    {
      prompt: 'What is deadlock? Explain the four necessary conditions.',
      keywords: ['deadlock', 'mutual', 'hold', 'wait', 'preemption', 'circular']
    },
    {
      prompt: 'How does virtual memory help a system run large programs?',
      keywords: ['virtual', 'memory', 'page', 'disk', 'address', 'physical', 'swap']
    },
    {
      prompt: 'Compare paging and segmentation.',
      keywords: ['paging', 'segmentation', 'page', 'segment', 'fragmentation', 'memory']
    },
    {
      prompt: 'What is a context switch and why is it expensive?',
      keywords: ['context', 'switch', 'registers', 'scheduler', 'cpu', 'overhead']
    },
    {
      prompt: 'Explain round robin scheduling and the effect of time quantum.',
      keywords: ['round', 'robin', 'time', 'quantum', 'scheduling', 'response', 'waiting']
    },
    {
      prompt: 'What is starvation and how can aging solve it?',
      keywords: ['starvation', 'aging', 'priority', 'scheduler', 'waiting', 'process']
    },
    {
      prompt: 'How do mutexes and semaphores differ?',
      keywords: ['mutex', 'semaphore', 'lock', 'critical', 'binary', 'counting', 'synchronization']
    },
    {
      prompt: 'What is the role of an interrupt in an operating system?',
      keywords: ['interrupt', 'hardware', 'software', 'handler', 'cpu', 'event']
    }
  ],
  DBMS: [
    {
      prompt: 'Explain normalization and why 3NF is useful.',
      keywords: ['normalization', '3nf', 'dependency', 'redundancy', 'anomaly', 'table']
    },
    {
      prompt: 'What is the difference between a primary key and a foreign key?',
      keywords: ['primary', 'foreign', 'key', 'unique', 'reference', 'relationship']
    },
    {
      prompt: 'Explain ACID properties with an example transaction.',
      keywords: ['acid', 'atomicity', 'consistency', 'isolation', 'durability', 'transaction']
    },
    {
      prompt: 'How does indexing improve query performance, and what is the tradeoff?',
      keywords: ['index', 'query', 'performance', 'read', 'write', 'storage', 'b-tree']
    },
    {
      prompt: 'Compare inner join, left join, and full outer join.',
      keywords: ['join', 'inner', 'left', 'outer', 'matching', 'rows', 'null']
    },
    {
      prompt: 'What are transaction isolation levels and why do they matter?',
      keywords: ['isolation', 'transaction', 'dirty', 'repeatable', 'phantom', 'serializable']
    },
    {
      prompt: 'Explain the difference between SQL and NoSQL databases.',
      keywords: ['sql', 'nosql', 'schema', 'relational', 'document', 'scale', 'consistency']
    },
    {
      prompt: 'What is a composite key and when would you use it?',
      keywords: ['composite', 'key', 'columns', 'unique', 'relationship', 'table']
    },
    {
      prompt: 'How would you detect and improve a slow database query?',
      keywords: ['slow', 'query', 'explain', 'index', 'plan', 'optimize', 'filter']
    },
    {
      prompt: 'What is denormalization and when can it be acceptable?',
      keywords: ['denormalization', 'performance', 'redundancy', 'read', 'tradeoff', 'reporting']
    }
  ],
  DSA: [
    {
      prompt: 'Given an array, how would you find two numbers that sum to a target?',
      keywords: ['hash', 'map', 'array', 'target', 'sum', 'time', 'complexity']
    },
    {
      prompt: 'Explain binary search and the conditions required to use it.',
      keywords: ['binary', 'search', 'sorted', 'mid', 'left', 'right', 'log']
    },
    {
      prompt: 'How would you detect a cycle in a linked list?',
      keywords: ['cycle', 'linked', 'list', 'slow', 'fast', 'pointer', 'floyd']
    },
    {
      prompt: 'When would you use BFS instead of DFS?',
      keywords: ['bfs', 'dfs', 'queue', 'stack', 'shortest', 'graph', 'level']
    },
    {
      prompt: 'Explain dynamic programming using the climbing stairs problem.',
      keywords: ['dynamic', 'programming', 'state', 'transition', 'base', 'memoization', 'tabulation']
    }
  ]
};

const clampCount = (value, subject) => {
  const number = Number(value);
  const { min, max } = SUBJECT_LIMITS[subject];

  if (!Number.isInteger(number) || number < min || number > max) {
    return null;
  }

  return number;
};

const shuffle = (items) => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
};

const buildLocalQuestions = ({ level, counts }) => Object.keys(SUBJECT_LIMITS).flatMap((subject) => (
  shuffle(QUESTION_BANK[subject]).slice(0, counts[subject]).map((question, index) => ({
    id: `${subject}-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    subject,
    subjectLabel: SUBJECT_LIMITS[subject].label,
    level,
    questionText: `${question.prompt} Answer at a ${level.toLowerCase()} interview depth.`,
    keywords: question.keywords
  }))
));

const parseJsonObject = (text) => {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
};

const callOpenAI = async (messages, temperature = 0.4) => {
  if (!process.env.OPENAI_API_KEY || typeof fetch !== 'function') {
    return null;
  }

  const response = await fetch(process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature,
      messages
    })
  });

  if (!response.ok) {
    throw new Error(`AI provider returned ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
};

const generateAiQuestions = async ({ level, counts }) => {
  const requested = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([subject, count]) => `${count} ${subject}`)
    .join(', ');

  const content = await callOpenAI([
    {
      role: 'system',
      content: 'You create interview practice questions. Return only valid JSON.'
    },
    {
      role: 'user',
      content: `Create unique ${level} questions for these counts: ${requested}. Use subjects OOP, OS, DBMS, DSA. Return {"questions":[{"subject":"OOP","questionText":"...","keywords":["..."]}]}. Keywords must be short lowercase scoring concepts.`
    }
  ]);

  if (!content) return null;

  const parsed = parseJsonObject(content);
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];

  return questions
    .filter((question) => SUBJECT_LIMITS[question.subject] && question.questionText)
    .map((question, index) => ({
      id: `ai-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      subject: question.subject,
      subjectLabel: SUBJECT_LIMITS[question.subject].label,
      level,
      questionText: question.questionText,
      keywords: Array.isArray(question.keywords) ? question.keywords : []
    }));
};

const evaluateLocally = ({ answer, question }) => {
  const normalizedAnswer = answer.toLowerCase();
  const words = normalizedAnswer.split(/\W+/).filter(Boolean);
  const uniqueWords = new Set(words);
  const matchedKeywords = question.keywords.filter((keyword) => normalizedAnswer.includes(keyword.toLowerCase()));
  const keywordRatio = question.keywords.length ? matchedKeywords.length / question.keywords.length : 0.35;
  const lengthScore = Math.min(words.length / 80, 1);
  const structureScore = /example|because|therefore|tradeoff|complexity|scenario|steps|first|second/.test(normalizedAnswer) ? 1 : 0.45;
  const specificityScore = uniqueWords.size > 35 ? 1 : Math.max(0.35, uniqueWords.size / 35);
  const score = Math.max(1, Math.min(10, Math.round(10 * ((keywordRatio * 0.45) + (lengthScore * 0.25) + (structureScore * 0.15) + (specificityScore * 0.15)))));

  const strengths = [];
  const improvements = [];

  if (matchedKeywords.length > 0) {
    strengths.push(`Covered key ideas: ${matchedKeywords.slice(0, 4).join(', ')}.`);
  } else {
    improvements.push('Mention the core concept terms more directly.');
  }

  if (words.length >= 60) {
    strengths.push('Answer has enough depth for evaluation.');
  } else {
    improvements.push('Add more detail, ideally with a short example or tradeoff.');
  }

  if (structureScore === 1) {
    strengths.push('Response is framed with reasoning or an example.');
  } else {
    improvements.push('Structure the answer as definition, mechanism, example, and tradeoff.');
  }

  return {
    score,
    feedback: score >= 8
      ? 'Strong answer. It is clear, relevant, and covers the important concepts.'
      : score >= 5
        ? 'Decent answer. It has the right direction, but needs more precision and interview-ready structure.'
        : 'Needs work. The answer should define the concept clearly and include the main technical points.',
    strengths: strengths.length ? strengths : ['You attempted the question and stayed on topic.'],
    improvements: improvements.length ? improvements : ['Tighten the answer with one concrete example.']
  };
};

const evaluateWithAi = async ({ answer, question }) => {
  const content = await callOpenAI([
    {
      role: 'system',
      content: 'You are a strict but helpful technical interviewer. Return only valid JSON.'
    },
    {
      role: 'user',
      content: `Question: ${question.questionText}\nCandidate answer: ${answer}\nEvaluate from 1 to 10. Return {"score":number,"feedback":"...","strengths":["..."],"improvements":["..."]}.`
    }
  ], 0.2);

  if (!content) return null;

  const parsed = parseJsonObject(content);
  if (!parsed || !Number.isFinite(Number(parsed.score))) return null;

  return {
    score: Math.max(1, Math.min(10, Math.round(Number(parsed.score)))),
    feedback: parsed.feedback || 'Answer evaluated.',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 3) : []
  };
};

const getCurrentQuestion = (session) => {
  const question = session.questions[session.currentIndex];

  if (!question) return null;

  return {
    id: question.id,
    subject: question.subject,
    subjectLabel: question.subjectLabel,
    level: question.level,
    questionText: question.questionText,
    number: session.currentIndex + 1,
    total: session.questions.length
  };
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const SUBJECT_ANALYTICS = {
  DSA: { label: 'Data Structures and Algorithms', sheetKey: 'DSA' },
  OS: { label: 'Operating Systems', sheetKey: 'OS' },
  DBMS: { label: 'Database Management Systems', sheetKey: 'DBMS' },
  OOP: { label: 'Object Oriented Programming', sheetKey: 'OOP' }
};

const TOPIC_ANALYTICS = [
  {
    topic: 'Graphs',
    subject: 'DSA',
    sheetKey: 'DSA',
    keywords: ['graph', 'bfs', 'dfs', 'cycle', 'shortest', 'queue', 'stack']
  },
  {
    topic: 'Deadlocks',
    subject: 'OS',
    sheetKey: 'OS',
    keywords: ['deadlock', 'mutual', 'hold', 'wait', 'preemption', 'circular']
  },
  {
    topic: 'Normalization',
    subject: 'DBMS',
    sheetKey: 'DBMS',
    keywords: ['normalization', '3nf', 'dependency', 'redundancy', 'anomaly']
  }
];

const toPercent = (score) => Math.max(0, Math.min(100, Number(score) || 0));

const getSheetPercent = (sheetProgress, key) => {
  const value = sheetProgress?.[key];
  if (typeof value === 'number') return toPercent(value);
  if (value && typeof value.percent === 'number') return toPercent(value.percent);
  return 0;
};

const buildRating = ({ interviewScore, sheetScore }) => {
  if (interviewScore === null && sheetScore === null) return 0;
  if (interviewScore === null) return Math.round(sheetScore);
  if (sheetScore === null) return Math.round(interviewScore);
  return Math.round((interviewScore * 0.65) + (sheetScore * 0.35));
};

router.post('/start', authMiddleware, async (req, res) => {
  const level = LEVELS.includes(req.body.level) ? req.body.level : null;
  const counts = {};

  Object.keys(SUBJECT_LIMITS).forEach((subject) => {
    counts[subject] = clampCount(req.body.counts?.[subject] ?? 0, subject);
  });

  if (!level || Object.values(counts).some((count) => count === null)) {
    return res.status(400).json({ message: 'Choose a valid level and question count.' });
  }

  const totalQuestions = Object.values(counts).reduce((total, count) => total + count, 0);

  if (totalQuestions < 1) {
    return res.status(400).json({ message: 'Select at least one question.' });
  }

  try {
    let questions = null;

    try {
      questions = await generateAiQuestions({ level, counts });
    } catch (err) {
      console.error(`AI question generation failed: ${err.message}`);
    }

    if (!questions || questions.length !== totalQuestions) {
      questions = buildLocalQuestions({ level, counts });
    }

    const orderedQuestions = shuffle(questions);
    const client = await pool.connect();
    let sessionId;
    let interviewId;
    let persistedQuestions;

    try {
      await client.query('BEGIN');

      const interviewResult = await client.query(
        'INSERT INTO interviews (user_id, type) VALUES ($1, $2) RETURNING id',
        [req.user.id, 'Mixed']
      );
      interviewId = interviewResult.rows[0].id;

      const sessionResult = await client.query(
        `INSERT INTO interview_sessions (user_id, interview_id, type, level, total_questions)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [req.user.id, interviewId, 'Mixed', level, orderedQuestions.length]
      );
      sessionId = sessionResult.rows[0].id;

      persistedQuestions = await Promise.all(orderedQuestions.map(async (question, index) => {
        const questionResult = await client.query(
          `INSERT INTO interview_questions
            (session_id, subject, subject_label, question_text, level, position, keywords)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            sessionId,
            question.subject,
            question.subjectLabel,
            question.questionText,
            question.level,
            index + 1,
            JSON.stringify(question.keywords || [])
          ]
        );

        return {
          ...question,
          dbQuestionId: questionResult.rows[0].id
        };
      }));

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const session = {
      id: sessionId,
      interviewId,
      userId: req.user.id,
      level,
      counts,
      currentIndex: 0,
      questions: persistedQuestions,
      answers: [],
      startedAt: new Date().toISOString()
    };

    sessions.set(String(session.id), session);

    res.status(201).json({
      interviewId: session.id,
      level,
      totalQuestions,
      question: getCurrentQuestion(session),
      provider: process.env.OPENAI_API_KEY ? 'ai' : 'local'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error. Check that PostgreSQL is running and the database tables are created.' });
  }
});

router.post('/:id/answer', authMiddleware, async (req, res) => {
  const session = sessions.get(String(req.params.id));
  const answer = String(req.body.answer || '').trim();

  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ message: 'Interview session not found. Please start a new interview.' });
  }

  if (!answer || answer.length < 20) {
    return res.status(400).json({ message: 'Write at least 20 characters so the answer can be evaluated.' });
  }

  const question = session.questions[session.currentIndex];

  if (!question) {
    return res.status(400).json({ message: 'This interview is already complete.' });
  }

  try {
    let evaluation = null;

    try {
      evaluation = await evaluateWithAi({ answer, question });
    } catch (err) {
      console.error(`AI answer evaluation failed: ${err.message}`);
    }

    if (!evaluation) {
      evaluation = evaluateLocally({ answer, question });
    }

    session.answers.push({
      questionId: question.id,
      dbQuestionId: question.dbQuestionId,
      subject: question.subject,
      answer,
      evaluation
    });

    await pool.query(
      `INSERT INTO interview_answers
        (question_id, user_id, answer_text, score, feedback, strengths, improvements)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        question.dbQuestionId,
        req.user.id,
        answer,
        evaluation.score,
        evaluation.feedback,
        JSON.stringify(evaluation.strengths || []),
        JSON.stringify(evaluation.improvements || [])
      ]
    );

    session.currentIndex += 1;

    const completed = session.currentIndex >= session.questions.length;
    const averageScore = Number((session.answers.reduce((total, item) => total + item.evaluation.score, 0) / session.answers.length).toFixed(1));

    if (completed) {
      await pool.query(
        'UPDATE interviews SET score = $1, status = $2 WHERE id = $3 AND user_id = $4',
        [averageScore * 10, 'completed', session.interviewId, req.user.id]
      );
      await pool.query(
        `UPDATE interview_sessions
         SET average_score = $1, status = $2, completed_at = NOW()
         WHERE id = $3 AND user_id = $4`,
        [averageScore, 'completed', session.id, req.user.id]
      );
      sessions.delete(String(session.id));
    }

    res.json({
      evaluation,
      completed,
      averageScore,
      nextQuestion: completed ? null : getCurrentQuestion(session)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Unable to evaluate the answer right now.' });
  }
});

router.get('/history', authMiddleware, async (req, res) => {
  try {
    const sessionsResult = await pool.query(
      `SELECT
        id,
        type,
        level,
        status,
        total_questions,
        average_score,
        started_at,
        completed_at
       FROM interview_sessions
       WHERE user_id = $1
       ORDER BY started_at DESC
       LIMIT 25`,
      [req.user.id]
    );

    const sessionIds = sessionsResult.rows.map((session) => session.id);

    if (sessionIds.length === 0) {
      return res.json({ sessions: [] });
    }

    const questionsResult = await pool.query(
      `SELECT
        q.id,
        q.session_id,
        q.subject,
        q.subject_label,
        q.question_text,
        q.position,
        q.keywords,
        a.answer_text,
        a.score,
        a.feedback,
        a.strengths,
        a.improvements,
        a.answered_at
       FROM interview_questions q
       LEFT JOIN interview_answers a
        ON a.question_id = q.id AND a.user_id = $2
       WHERE q.session_id = ANY($1::int[])
       ORDER BY q.session_id DESC, q.position ASC`,
      [sessionIds, req.user.id]
    );

    const questionsBySession = questionsResult.rows.reduce((summary, row) => {
      if (!summary[row.session_id]) summary[row.session_id] = [];

      summary[row.session_id].push({
        id: row.id,
        subject: row.subject,
        subjectLabel: row.subject_label,
        questionText: row.question_text,
        position: row.position,
        keywords: parseJsonArray(row.keywords),
        answer: row.answer_text,
        score: row.score === null ? null : Number(row.score),
        feedback: row.feedback,
        strengths: parseJsonArray(row.strengths),
        improvements: parseJsonArray(row.improvements),
        answeredAt: row.answered_at
      });

      return summary;
    }, {});

    res.json({
      sessions: sessionsResult.rows.map((session) => ({
        id: session.id,
        type: session.type,
        level: session.level,
        status: session.status,
        totalQuestions: session.total_questions,
        averageScore: session.average_score === null ? null : Number(session.average_score),
        startedAt: session.started_at,
        completedAt: session.completed_at,
        questions: questionsBySession[session.id] || []
      }))
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Unable to load interview history.' });
  }
});

router.post('/analytics', authMiddleware, async (req, res) => {
  const sheetProgress = req.body.sheetProgress || {};

  try {
    const subjectResult = await pool.query(
      `SELECT
        q.subject,
        AVG(a.score) * 10 AS interview_score,
        COUNT(a.id) AS answered_count
       FROM interview_answers a
       JOIN interview_questions q ON q.id = a.question_id
       JOIN interview_sessions s ON s.id = q.session_id
       WHERE s.user_id = $1
       GROUP BY q.subject`,
      [req.user.id]
    );

    const answerResult = await pool.query(
      `SELECT
        q.subject,
        q.question_text,
        q.keywords,
        a.score
       FROM interview_answers a
       JOIN interview_questions q ON q.id = a.question_id
       JOIN interview_sessions s ON s.id = q.session_id
       WHERE s.user_id = $1`,
      [req.user.id]
    );

    const subjectRows = new Map(subjectResult.rows.map((row) => [row.subject, row]));

    const subjects = Object.entries(SUBJECT_ANALYTICS).map(([subject, config]) => {
      const row = subjectRows.get(subject);
      const interviewScore = row ? toPercent(row.interview_score) : null;
      const sheetScore = getSheetPercent(sheetProgress, config.sheetKey);
      const rating = buildRating({ interviewScore, sheetScore });

      return {
        subject,
        label: config.label,
        interviewScore,
        sheetProgress: sheetScore,
        rating,
        answeredCount: row ? Number(row.answered_count) : 0,
        status: rating < 45 ? 'Weak' : rating < 70 ? 'Needs Practice' : 'Strong'
      };
    }).sort((a, b) => a.rating - b.rating);

    const topics = TOPIC_ANALYTICS.map((topicConfig) => {
      const matchingAnswers = answerResult.rows.filter((row) => {
        if (row.subject !== topicConfig.subject) return false;

        const text = `${row.question_text} ${parseJsonArray(row.keywords).join(' ')}`.toLowerCase();
        return topicConfig.keywords.some((keyword) => text.includes(keyword));
      });

      const interviewScore = matchingAnswers.length
        ? toPercent((matchingAnswers.reduce((total, row) => total + Number(row.score || 0), 0) / matchingAnswers.length) * 10)
        : null;
      const sheetScore = getSheetPercent(sheetProgress, topicConfig.sheetKey);
      const rating = buildRating({ interviewScore, sheetScore });

      return {
        topic: topicConfig.topic,
        subject: topicConfig.subject,
        interviewScore,
        sheetProgress: sheetScore,
        rating,
        answeredCount: matchingAnswers.length,
        status: rating < 45 ? 'Weak' : rating < 70 ? 'Needs Practice' : 'Strong'
      };
    }).sort((a, b) => a.rating - b.rating);

    res.json({
      subjects,
      weakAreas: topics,
      lowestSubjects: subjects.slice(0, 3),
      recommendation: topics.length > 0
        ? `Prioritize ${topics[0].topic} next.`
        : 'Complete one interview and mark sheet progress to unlock better recommendations.'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Unable to build weakness analytics.' });
  }
});

module.exports = router;
