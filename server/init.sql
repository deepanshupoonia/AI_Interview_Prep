CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'student';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

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
);

CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50),
    question_text TEXT
);

CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    icon VARCHAR(40),
    display_order INT NOT NULL DEFAULT 0,
    difficulties JSONB NOT NULL DEFAULT '["Beginner","Intermediate","Advanced"]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subjects_display_order
ON subjects(display_order);

CREATE TABLE IF NOT EXISTS subject_prompt_versions (
    id SERIAL PRIMARY KEY,
    subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    prompt_type VARCHAR(30) NOT NULL,
    version_number INT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(subject_id, prompt_type, version_number)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_subject_type
ON subject_prompt_versions(subject_id, prompt_type, is_active);

CREATE TABLE IF NOT EXISTS subject_settings (
    id SERIAL PRIMARY KEY,
    subject_id INT NOT NULL UNIQUE REFERENCES subjects(id) ON DELETE CASCADE,
    max_questions INT NOT NULL DEFAULT 5,
    time_limit_minutes INT NOT NULL DEFAULT 30,
    difficulty_distribution JSONB NOT NULL DEFAULT '{"Beginner": 30, "Intermediate": 50, "Advanced": 20}'::jsonb,
    ai_model VARCHAR(80) NOT NULL DEFAULT 'gpt-5.4-mini',
    temperature NUMERIC(3,2) NOT NULL DEFAULT 0.70,
    retrieval_settings JSONB NOT NULL DEFAULT '{"topK": 5, "similarityThreshold": 0.75}'::jsonb,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_materials (
    id SERIAL PRIMARY KEY,
    subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    material_type VARCHAR(40) NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    difficulty VARCHAR(30) NOT NULL DEFAULT 'Intermediate',
    visibility VARCHAR(20) NOT NULL DEFAULT 'private',
    storage_key TEXT,
    source_url TEXT,
    mime_type VARCHAR(120),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    job_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    embedding_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_materials_subject_id
ON study_materials(subject_id);

CREATE INDEX IF NOT EXISTS idx_study_materials_job_status
ON study_materials(job_status);

CREATE TABLE IF NOT EXISTS question_bank (
    id SERIAL PRIMARY KEY,
    subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    difficulty VARCHAR(30) NOT NULL DEFAULT 'Intermediate',
    topic VARCHAR(120),
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    answer_hint TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    bulk_source VARCHAR(120),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_bank_subject_id
ON question_bank(subject_id);

CREATE TABLE IF NOT EXISTS admin_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(60) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    related_entity_type VARCHAR(60),
    related_entity_id INT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_jobs_status
ON admin_jobs(status);

CREATE INDEX IF NOT EXISTS idx_admin_jobs_job_type
ON admin_jobs(job_type);

INSERT INTO subjects (slug, name, description, icon, display_order, difficulties)
SELECT seed.slug, seed.name, seed.description, seed.icon, seed.display_order, seed.difficulties
FROM (VALUES
    ('oop', 'Object Oriented Programming', 'Design, inheritance, abstraction, polymorphism, and object oriented architecture.', '🧩', 1, '["Beginner","Intermediate","Advanced"]'::jsonb),
    ('os', 'Operating Systems', 'Processes, threads, memory management, synchronization, and scheduling.', '⚙️', 2, '["Beginner","Intermediate","Advanced"]'::jsonb),
    ('dbms', 'Database Management Systems', 'Normalization, SQL, transactions, indexes, and data consistency.', '🗄️', 3, '["Beginner","Intermediate","Advanced"]'::jsonb),
    ('dsa', 'Data Structures and Algorithms', 'Arrays, linked lists, trees, graphs, and algorithmic problem solving.', '📐', 4, '["Beginner","Intermediate","Advanced"]'::jsonb),
    ('resume', 'Resume Based', 'Questions derived from projects, internships, and professional experience.', '📄', 5, '["Beginner","Intermediate","Advanced"]'::jsonb)
) AS seed(slug, name, description, icon, display_order, difficulties)
WHERE NOT EXISTS (
    SELECT 1
    FROM subjects s
    WHERE s.slug = seed.slug
);

INSERT INTO subject_settings (subject_id, max_questions, time_limit_minutes, difficulty_distribution, ai_model, temperature, retrieval_settings)
SELECT s.id, seed.max_questions, seed.time_limit_minutes, seed.difficulty_distribution, seed.ai_model, seed.temperature, seed.retrieval_settings
FROM subjects s
JOIN (VALUES
    ('oop', 6, 30, '{"Beginner": 25, "Intermediate": 55, "Advanced": 20}'::jsonb, 'gpt-5.4-mini', 0.70, '{"topK": 5, "similarityThreshold": 0.75}'::jsonb),
    ('os', 6, 30, '{"Beginner": 25, "Intermediate": 55, "Advanced": 20}'::jsonb, 'gpt-5.4-mini', 0.70, '{"topK": 5, "similarityThreshold": 0.75}'::jsonb),
    ('dbms', 6, 30, '{"Beginner": 25, "Intermediate": 55, "Advanced": 20}'::jsonb, 'gpt-5.4-mini', 0.70, '{"topK": 5, "similarityThreshold": 0.75}'::jsonb),
    ('dsa', 5, 35, '{"Beginner": 20, "Intermediate": 50, "Advanced": 30}'::jsonb, 'gpt-5.4-mini', 0.65, '{"topK": 7, "similarityThreshold": 0.72}'::jsonb),
    ('resume', 4, 20, '{"Beginner": 35, "Intermediate": 45, "Advanced": 20}'::jsonb, 'gpt-5.4-mini', 0.60, '{"topK": 4, "similarityThreshold": 0.78}'::jsonb)
) AS seed(slug, max_questions, time_limit_minutes, difficulty_distribution, ai_model, temperature, retrieval_settings)
ON s.slug = seed.slug
WHERE NOT EXISTS (
    SELECT 1
    FROM subject_settings settings
    WHERE settings.subject_id = s.id
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

CREATE TABLE IF NOT EXISTS flipkart_questions (
    question_id INT PRIMARY KEY REFERENCES leetcode_questions(id) ON DELETE CASCADE,
    priority_order INT NOT NULL,
    frequency DECIMAL(12, 8),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apple_questions (
    question_id INT PRIMARY KEY REFERENCES leetcode_questions(id) ON DELETE CASCADE,
    priority_order INT NOT NULL,
    frequency DECIMAL(12, 8),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meesho_questions (
    question_id INT PRIMARY KEY REFERENCES leetcode_questions(id) ON DELETE CASCADE,
    priority_order INT NOT NULL,
    frequency DECIMAL(12, 8),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intel_questions (
    question_id INT PRIMARY KEY REFERENCES leetcode_questions(id) ON DELETE CASCADE,
    priority_order INT NOT NULL,
    frequency DECIMAL(12, 8),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nvidia_questions (
    question_id INT PRIMARY KEY REFERENCES leetcode_questions(id) ON DELETE CASCADE,
    priority_order INT NOT NULL,
    frequency DECIMAL(12, 8),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salesforce_questions (
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
