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
INSERT INTO questions (category, question_text) VALUES 
('HR', 'Tell me about yourself.'),
('DSA', 'Explain what a Hash Map is and its time complexity.'),
('OOP', 'What are the four pillars of Object Oriented Programming?'),
('DBMS', 'What is the difference between SQL and NoSQL?'),
('OS', 'What is a deadlock and how can it be avoided?');
