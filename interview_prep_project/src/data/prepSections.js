export const LEETCODE_LIST_URL = 'https://leetcode.com/problem-list/dp5qu70m/';

export const preparationSections = [
  {
    id: 'DSA',
    slug: 'dsa',
    title: 'DSA',
    description: 'Search company-wise coding questions by LeetCode id, title, company, or difficulty.',
    meta: 'Company lists',
    subsections: ['Google', 'Arista', 'Amazon'],
    contentTitle: 'DSA Problem Tracker',
    contentDescription: 'Track company-wise LeetCode questions from Google, Arista, and Amazon. Common problems share one LeetCode id, so progress stays consistent across companies.',
    totalItems: 1315,
    items: []
  },
  {
    id: 'HR',
    slug: 'hr',
    title: 'HR',
    description: 'Prepare structured answers for behavioral interview rounds.',
    meta: 'Story practice',
    subsections: ['Self Introduction', 'Projects', 'Strengths', 'Weaknesses', 'Conflict', 'Career Goals'],
    contentTitle: 'HR Answer Bank',
    contentDescription: 'Build crisp, repeatable answers for common behavioral questions.',
    items: [
      { id: 'hr-intro', title: 'Prepare your self introduction', type: 'Prompt', difficulty: 'Core', subsection: 'Self Introduction' },
      { id: 'hr-project', title: 'Explain your strongest project', type: 'Prompt', difficulty: 'Core', subsection: 'Projects' },
      { id: 'hr-conflict', title: 'Describe a conflict and how you handled it', type: 'Prompt', difficulty: 'Medium', subsection: 'Conflict' }
    ]
  },
  {
    id: 'OOP',
    slug: 'oops',
    title: 'OOPS',
    description: 'Revise core object-oriented concepts with interview prompts.',
    meta: 'Concept cards',
    subsections: ['Classes', 'Inheritance', 'Polymorphism', 'Abstraction', 'Encapsulation', 'SOLID'],
    contentTitle: 'OOPS Concept Tracker',
    contentDescription: 'Revise definitions, examples, and comparison-style questions.',
    items: [
      { id: 'oop-pillars', title: 'Four pillars of OOP', type: 'Concept', difficulty: 'Core', subsection: 'Classes' },
      { id: 'oop-poly', title: 'Compile-time vs runtime polymorphism', type: 'Concept', difficulty: 'Medium', subsection: 'Polymorphism' },
      { id: 'oop-solid', title: 'Explain SOLID with examples', type: 'Concept', difficulty: 'Medium', subsection: 'SOLID' }
    ]
  },
  {
    id: 'OS',
    slug: 'os',
    title: 'OS',
    description: 'Cover operating system fundamentals asked in technical rounds.',
    meta: 'CS core',
    subsections: ['Processes', 'Threads', 'Scheduling', 'Deadlocks', 'Memory', 'File Systems'],
    contentTitle: 'Operating Systems Tracker',
    contentDescription: 'Track OS fundamentals and common interview explanations.',
    items: [
      { id: 'os-process-thread', title: 'Process vs thread', type: 'Concept', difficulty: 'Core', subsection: 'Processes' },
      { id: 'os-deadlock', title: 'Deadlock conditions and prevention', type: 'Concept', difficulty: 'Medium', subsection: 'Deadlocks' },
      { id: 'os-paging', title: 'Paging and virtual memory', type: 'Concept', difficulty: 'Medium', subsection: 'Memory' }
    ]
  },
  {
    id: 'DBMS',
    slug: 'dbms',
    title: 'DBMS',
    description: 'Review database concepts, SQL, and transaction behavior.',
    meta: 'SQL focus',
    subsections: ['SQL', 'Normalization', 'Indexing', 'Transactions', 'Joins', 'ER Models'],
    contentTitle: 'DBMS Tracker',
    contentDescription: 'Track database theory, SQL patterns, and transaction concepts.',
    items: [
      { id: 'dbms-joins', title: 'Inner, left, right, and full joins', type: 'Concept', difficulty: 'Core', subsection: 'Joins' },
      { id: 'dbms-normalization', title: 'Normalization up to 3NF', type: 'Concept', difficulty: 'Medium', subsection: 'Normalization' },
      { id: 'dbms-acid', title: 'ACID properties and isolation levels', type: 'Concept', difficulty: 'Medium', subsection: 'Transactions' }
    ]
  }
];

export const getSectionBySlug = (slug) => {
  return preparationSections.find((section) => section.slug === slug);
};
