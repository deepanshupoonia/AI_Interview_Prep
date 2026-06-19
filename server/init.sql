CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interviews (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    type VARCHAR(50),
    score DECIMAL(4,2),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interview_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interview_id INT REFERENCES interviews(id) ON DELETE SET NULL,
    type VARCHAR(50) DEFAULT 'Mixed',
    level VARCHAR(30) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    total_questions INT NOT NULL DEFAULT 0,
    average_score DECIMAL(4,2),
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id
ON interview_sessions(user_id);

CREATE TABLE IF NOT EXISTS interview_questions (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    subject VARCHAR(30) NOT NULL,
    subject_label VARCHAR(100),
    question_text TEXT NOT NULL,
    level VARCHAR(30),
    position INT NOT NULL,
    keywords JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_questions_session_id
ON interview_questions(session_id);

CREATE TABLE IF NOT EXISTS interview_answers (
    id SERIAL PRIMARY KEY,
    question_id INT NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    score DECIMAL(4,2) NOT NULL,
    feedback TEXT,
    strengths JSONB DEFAULT '[]'::jsonb,
    improvements JSONB DEFAULT '[]'::jsonb,
    answered_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_answers_user_id
ON interview_answers(user_id);

CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50),
    question_text TEXT
);

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
);

CREATE INDEX IF NOT EXISTS idx_leetcode_questions_leetcode_id
ON leetcode_questions(leetcode_id);

CREATE TABLE IF NOT EXISTS google_questions (
    question_id INT PRIMARY KEY REFERENCES leetcode_questions(id) ON DELETE CASCADE,
    priority_order INT NOT NULL,
    frequency DECIMAL(12, 8),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS amazon_questions (
    question_id INT PRIMARY KEY REFERENCES leetcode_questions(id) ON DELETE CASCADE,
    priority_order INT NOT NULL,
    frequency DECIMAL(12, 8),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arista_questions (
    question_id INT PRIMARY KEY REFERENCES leetcode_questions(id) ON DELETE CASCADE,
    priority_order INT NOT NULL,
    frequency DECIMAL(12, 8),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Basic mock data for questions to verify the start route
INSERT INTO questions (category, question_text)
SELECT seed.category, seed.question_text
FROM (VALUES
    ('HR', 'Tell me about yourself.'),
    ('DSA', 'Explain what a Hash Map is and its time complexity.'),
    ('OOP', 'What are the four pillars of Object Oriented Programming?'),
    ('DBMS', 'What is the difference between SQL and NoSQL?'),
    ('OS', 'What is a deadlock and how can it be avoided?')
) AS seed(category, question_text)
WHERE NOT EXISTS (
    SELECT 1
    FROM questions q
    WHERE q.category = seed.category
      AND q.question_text = seed.question_text
);
