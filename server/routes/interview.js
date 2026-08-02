const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const SUBJECT_LIMITS = {
  OOP: { label: 'Object Oriented Programming', min: 0, max: 10 },
  OS: { label: 'Operating Systems', min: 0, max: 10 },
  DBMS: { label: 'Database Management Systems', min: 0, max: 10 },
  DSA: { label: 'Data Structures and Algorithms', min: 0, max: 5 },
  RESUME: { label: 'Resume-Based', min: 0, max: 10 }
};

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const INTERVIEW_TYPES = ['Core Subjects', 'Resume-Based', 'Mixed'];
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
  RESUME: [],
  DSA: [
    {
      problemKey: 'two-sum',
      title: 'Two Sum',
      prompt: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      description: 'You may assume that each input has exactly one solution, and you may not use the same element twice. Return the indices in any order.',
      constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9', '-10^9 <= target <= 10^9', 'Exactly one valid answer exists.'],
      keywords: ['hash', 'map', 'array', 'target', 'sum', 'time', 'complexity'],
      questionType: 'coding',
      testCases: [
        { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
        { input: [[3, 2, 4], 6], expected: [1, 2] },
        { input: [[3, 3], 6], expected: [0, 1] }
      ]
    },
    {
      problemKey: 'binary-search',
      title: 'Binary Search',
      prompt: 'Given a sorted array of integers nums and an integer target, return the index of target. If target is not present, return -1.',
      description: 'Your algorithm must run in O(log n) time.',
      constraints: ['1 <= nums.length <= 10^4', 'nums is sorted in strictly increasing order.', '-10^9 <= nums[i], target <= 10^9'],
      keywords: ['binary', 'search', 'sorted', 'mid', 'left', 'right', 'log'],
      questionType: 'coding',
      testCases: [
        { input: [[-1, 0, 3, 5, 9, 12], 9], expected: 4 },
        { input: [[-1, 0, 3, 5, 9, 12], 2], expected: -1 },
        { input: [[5], 5], expected: 0 }
      ]
    },
    {
      problemKey: 'climbing-stairs',
      title: 'Climbing Stairs',
      prompt: 'You are climbing a staircase. It takes n steps to reach the top. Each time you can climb either 1 or 2 steps. Return the number of distinct ways to climb to the top.',
      description: 'This is a classic dynamic programming problem. Think about the recurrence relation between smaller stair counts.',
      constraints: ['1 <= n <= 45'],
      keywords: ['dynamic', 'programming', 'state', 'transition', 'base', 'memoization', 'tabulation'],
      questionType: 'coding',
      testCases: [
        { input: [2], expected: 2 },
        { input: [3], expected: 3 },
        { input: [5], expected: 8 }
      ]
    },
    {
      problemKey: 'sqrtx',
      title: 'Sqrt(x)',
      difficulty: 'Easy',
      prompt: 'Given a non-negative integer x, return the integer part of its square root.',
      description: 'Do not use a built-in power or square root function.',
      constraints: ['0 <= x <= 2^31 - 1'],
      keywords: ['math', 'binary', 'search', 'square', 'root'],
      questionType: 'coding',
      testCases: [
        { input: [4], expected: 2 },
        { input: [8], expected: 2 },
        { input: [1], expected: 1 }
      ]
    },
    {
      problemKey: 'reverse-integer',
      title: 'Reverse Integer',
      difficulty: 'Medium',
      prompt: 'Given a signed 32-bit integer x, return x with its digits reversed.',
      description: 'If reversing x causes the value to go outside the signed 32-bit integer range, return 0.',
      constraints: ['-2^31 <= x <= 2^31 - 1'],
      keywords: ['math', 'digits', 'overflow', 'reverse'],
      questionType: 'coding',
      testCases: [
        { input: [123], expected: 321 },
        { input: [-123], expected: -321 },
        { input: [1534236469], expected: 0 }
      ]
    },
    {
      problemKey: 'count-primes',
      title: 'Count Primes',
      difficulty: 'Medium',
      prompt: 'Given an integer n, return the number of prime numbers that are strictly less than n.',
      description: 'You can use a sieve or another efficient prime-counting approach.',
      constraints: ['0 <= n <= 5 * 10^6'],
      keywords: ['prime', 'sieve', 'math', 'count'],
      questionType: 'coding',
      testCases: [
        { input: [10], expected: 4 },
        { input: [0], expected: 0 },
        { input: [20], expected: 8 }
      ]
    },
    {
      problemKey: 'add-digits',
      title: 'Add Digits',
      difficulty: 'Easy',
      prompt: 'Given an integer num, repeatedly add all its digits until the result has only one digit.',
      description: 'Return that single digit.',
      constraints: ['0 <= num <= 2^31 - 1'],
      keywords: ['math', 'digits', 'sum', 'loop'],
      questionType: 'coding',
      testCases: [
        { input: [38], expected: 2 },
        { input: [0], expected: 0 },
        { input: [99], expected: 9 }
      ]
    },
    {
      problemKey: 'number-of-1-bits',
      title: 'Number of 1 Bits',
      difficulty: 'Easy',
      prompt: 'Given a positive integer n, return the number of set bits in its binary representation.',
      description: 'This is sometimes called the Hamming weight.',
      constraints: ['0 <= n <= 2^31 - 1'],
      keywords: ['bit', 'binary', 'count', 'hamming'],
      questionType: 'coding',
      testCases: [
        { input: [11], expected: 3 },
        { input: [128], expected: 1 },
        { input: [2147483645], expected: 30 }
      ]
    },
    {
      problemKey: 'reverse-bits',
      title: 'Reverse Bits',
      difficulty: 'Easy',
      prompt: 'Reverse bits of a given 32-bit unsigned integer.',
      description: 'Treat the input as a 32-bit value.',
      constraints: ['0 <= n <= 2^32 - 1'],
      keywords: ['bit', 'reverse', 'binary', 'mask'],
      questionType: 'coding',
      testCases: [
        { input: [43261596], expected: 964176192 },
        { input: [0], expected: 0 },
        { input: [1], expected: 2147483648 }
      ]
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

const DSA_LEVEL_PREFERENCES = {
  Beginner: ['Easy', 'Medium', 'Hard'],
  Intermediate: ['Medium', 'Easy', 'Hard'],
  Advanced: ['Hard', 'Medium', 'Easy']
};

const normalizeTopicPlan = (topicPlan) => {
  if (!Array.isArray(topicPlan)) {
    return [];
  }

  return topicPlan
    .map((entry) => ({
      subject: Object.keys(SUBJECT_LIMITS).includes(entry?.subject) ? entry.subject : null,
      topic: String(entry?.topic || '').trim(),
      count: Math.max(0, Math.min(10, Number(entry?.count || 0)))
    }))
    .filter((entry) => entry.subject && entry.topic && entry.count > 0);
};

const topicPlanBySubject = (topicPlan) => normalizeTopicPlan(topicPlan).reduce((accumulator, entry) => {
  accumulator[entry.subject] = entry;
  return accumulator;
}, {});

const getSubjectQuestionPool = (subject, level) => {
  const questions = QUESTION_BANK[subject] || [];

  if (subject !== 'DSA') {
    return shuffle(questions);
  }

  const preferredDifficulties = DSA_LEVEL_PREFERENCES[level] || DSA_LEVEL_PREFERENCES.Intermediate;

  return shuffle(questions).sort((left, right) => {
    const leftRank = preferredDifficulties.indexOf(left.difficulty || 'Medium');
    const rightRank = preferredDifficulties.indexOf(right.difficulty || 'Medium');

    return (leftRank === -1 ? preferredDifficulties.length : leftRank) - (rightRank === -1 ? preferredDifficulties.length : rightRank);
  });
};

const CODE_TEMPLATES = {
  javascript: {
    'two-sum': `function solution(nums, target) {
  // Return the indices of two numbers that add up to target.
}`,
    'binary-search': `function solution(nums, target) {
  // Return the index of target, or -1 if it does not exist.
}`,
    'climbing-stairs': `function solution(n) {
  // Return the number of distinct ways to climb n stairs.
}`,
    'sqrtx': `function solution(x) {
  // Return the integer part of the square root.
}`,
    'reverse-integer': `function solution(x) {
  // Return the reversed integer, or 0 if it overflows.
}`,
    'count-primes': `function solution(n) {
  // Return the count of primes smaller than n.
}`,
    'add-digits': `function solution(num) {
  // Return the repeated digit sum until a single digit remains.
}`,
    'number-of-1-bits': `function solution(n) {
  // Return the number of set bits in n.
}`,
    'reverse-bits': `function solution(n) {
  // Return the 32-bit reversed value.
}`
  },
  python: {
    'two-sum': `def solution(nums, target):
    # Return the indices of two numbers that add up to target.
    pass`,
    'binary-search': `def solution(nums, target):
    # Return the index of target, or -1 if it does not exist.
    pass`,
    'climbing-stairs': `def solution(n):
    # Return the number of distinct ways to climb n stairs.
    pass`,
    'sqrtx': `def solution(x):
    # Return the integer part of the square root.
    pass`,
    'reverse-integer': `def solution(x):
    # Return the reversed integer, or 0 if it overflows.
    pass`,
    'count-primes': `def solution(n):
    # Return the count of primes smaller than n.
    pass`,
    'add-digits': `def solution(num):
    # Return the repeated digit sum until a single digit remains.
    pass`,
    'number-of-1-bits': `def solution(n):
    # Return the number of set bits in n.
    pass`,
    'reverse-bits': `def solution(n):
    # Return the 32-bit reversed value.
    pass`
  },
  cpp: {
    'two-sum': `#include <bits/stdc++.h>
using namespace std;

vector<int> solution(vector<int> nums, int target) {
  // Return the indices of two numbers that add up to target.
}`,
    'binary-search': `#include <bits/stdc++.h>
using namespace std;

int solution(vector<int> nums, int target) {
  // Return the index of target, or -1 if it does not exist.
}`,
    'climbing-stairs': `#include <bits/stdc++.h>
using namespace std;

int solution(int n) {
  // Return the number of distinct ways to climb n stairs.
}`,
    'sqrtx': `#include <bits/stdc++.h>
using namespace std;

int solution(int x) {
  // Return the integer part of the square root.
}`,
    'reverse-integer': `#include <bits/stdc++.h>
using namespace std;

int solution(int x) {
  // Return the reversed integer, or 0 if it overflows.
}`,
    'count-primes': `#include <bits/stdc++.h>
using namespace std;

int solution(int n) {
  // Return the count of primes smaller than n.
}`,
    'add-digits': `#include <bits/stdc++.h>
using namespace std;

int solution(int num) {
  // Return the repeated digit sum until a single digit remains.
}`,
    'number-of-1-bits': `#include <bits/stdc++.h>
using namespace std;

int solution(int n) {
  // Return the number of set bits in n.
}`,
    'reverse-bits': `#include <bits/stdc++.h>
using namespace std;

int solution(int n) {
  // Return the 32-bit reversed value.
}`
  },
  c: {
    'two-sum': `#include <stdlib.h>

int* solution(int* nums, int numsSize, int target, int* returnSize) {
  // Return a malloc'ed array of two indices and set *returnSize = 2.
}`,
    'binary-search': `int solution(int* nums, int numsSize, int target) {
  // Return the index of target, or -1 if it does not exist.
}`,
    'climbing-stairs': `int solution(int n) {
  // Return the number of distinct ways to climb n stairs.
}`,
    'sqrtx': `int solution(int x) {
  // Return the integer part of the square root.
}`,
    'reverse-integer': `int solution(int x) {
  // Return the reversed integer, or 0 if it overflows.
}`,
    'count-primes': `int solution(int n) {
  // Return the count of primes smaller than n.
}`,
    'add-digits': `int solution(int num) {
  // Return the repeated digit sum until a single digit remains.
}`,
    'number-of-1-bits': `int solution(int n) {
  // Return the number of set bits in n.
}`,
    'reverse-bits': `int solution(int n) {
  // Return the 32-bit reversed value.
}`
  },
  java: {
    'two-sum': `class Solution {
  public int[] solution(int[] nums, int target) {
    // Return the indices of two numbers that add up to target.
    return new int[]{};
  }
}`,
    'binary-search': `class Solution {
  public int solution(int[] nums, int target) {
    // Return the index of target, or -1 if it does not exist.
    return -1;
  }
}`,
    'climbing-stairs': `class Solution {
  public int solution(int n) {
    // Return the number of distinct ways to climb n stairs.
    return 0;
  }
}`,
    'sqrtx': `class Solution {
  public int solution(int x) {
    // Return the integer part of the square root.
    return 0;
  }
}`,
    'reverse-integer': `class Solution {
  public int solution(int x) {
    // Return the reversed integer, or 0 if it overflows.
    return 0;
  }
}`,
    'count-primes': `class Solution {
  public int solution(int n) {
    // Return the count of primes smaller than n.
    return 0;
  }
}`,
    'add-digits': `class Solution {
  public int solution(int num) {
    // Return the repeated digit sum until a single digit remains.
    return 0;
  }
}`,
    'number-of-1-bits': `class Solution {
  public int solution(int n) {
    // Return the number of set bits in n.
    return 0;
  }
}`,
    'reverse-bits': `class Solution {
  public int solution(int n) {
    // Return the 32-bit reversed value.
    return 0;
  }
}`
  }
};

const getStarterCode = (problemKey, language = 'python') => CODE_TEMPLATES[language]?.[problemKey] || '';

const execFileAsync = (file, args, options = {}) => new Promise((resolve) => {
  execFile(file, args, { timeout: 5000, windowsHide: true, ...options }, (error, stdout, stderr) => {
    resolve({
      ok: !error,
      error,
      stdout: String(stdout || ''),
      stderr: String(stderr || '')
    });
  });
});

const arrayLiteral = (items) => `{${items.join(', ')}}`;

const normalizeRunOutput = (text) => {
  try {
    return JSON.parse(text.trim());
  } catch {
    return [];
  }
};

const buildPythonHarness = ({ code, question }) => `${code}

import json

tests = ${JSON.stringify(question.testCases)}
problem_key = ${JSON.stringify(question.problemKey)}
results = []
for index, case in enumerate(tests):
    try:
        actual = solution(*case["input"])
        passed = sorted(actual) == sorted(case["expected"]) if problem_key == "two-sum" else actual == case["expected"]
        results.append({"index": index, "input": case["input"], "expected": case["expected"], "actual": actual, "passed": passed})
    except Exception as error:
        results.append({"index": index, "input": case["input"], "expected": case["expected"], "actual": str(error), "passed": False})

print(json.dumps(results))
`;

const buildCppRunner = (problemKey) => {
  if (problemKey === 'two-sum') {
    return `
void runTest(int index, vector<int> nums, int target, vector<int> expected) {
  vector<int> actual = solution(nums, target);
  vector<int> sortedActual = actual;
  vector<int> sortedExpected = expected;
  sort(sortedActual.begin(), sortedActual.end());
  sort(sortedExpected.begin(), sortedExpected.end());
  printResult(index, vecToJson(expected), vecToJson(actual), sortedActual == sortedExpected);
}
`;
  }

  if (problemKey === 'binary-search') {
    return `
void runTest(int index, vector<int> nums, int target, int expected) {
  int actual = solution(nums, target);
  printResult(index, to_string(expected), to_string(actual), actual == expected);
}
`;
  }

  return `
void runTest(int index, int input, int expected) {
  int actual = solution(input);
  printResult(index, to_string(expected), to_string(actual), actual == expected);
}
`;
};

const buildCppHarness = ({ code, question }) => {
  const tests = question.testCases.map((testCase, index) => {
    if (question.problemKey === 'two-sum') {
      return `runTest(${index}, vector<int>${arrayLiteral(testCase.input[0])}, ${testCase.input[1]}, vector<int>${arrayLiteral(testCase.expected)});`;
    }
    if (question.problemKey === 'binary-search') {
      return `runTest(${index}, vector<int>${arrayLiteral(testCase.input[0])}, ${testCase.input[1]}, ${testCase.expected});`;
    }
    return `runTest(${index}, ${testCase.input[0]}, ${testCase.expected});`;
  }).join('\n  ');

  return `${code}

string vecToJson(vector<int> values) {
  string out = "[";
  for (int i = 0; i < (int)values.size(); i++) {
    if (i) out += ",";
    out += to_string(values[i]);
  }
  out += "]";
  return out;
}

void printResult(int index, string expected, string actual, bool passed) {
  cout << (index ? "," : "") << "{\\"index\\":" << index << ",\\"expected\\":" << expected << ",\\"actual\\":" << actual << ",\\"passed\\":" << (passed ? "true" : "false") << "}";
}

${buildCppRunner(question.problemKey)}

int main() {
  cout << "[";
  ${tests}
  cout << "]";
  return 0;
}
`;
};

const buildCRunner = (problemKey) => {
  if (problemKey === 'two-sum') {
    return `
void runTest(int index, int* nums, int numsSize, int target, int* expected, int expectedSize) {
  int returnSize = 0;
  int* actual = solution(nums, numsSize, target, &returnSize);
  int* actualCopy = malloc(sizeof(int) * returnSize);
  int* expectedCopy = malloc(sizeof(int) * expectedSize);
  for (int i = 0; i < returnSize; i++) actualCopy[i] = actual[i];
  for (int i = 0; i < expectedSize; i++) expectedCopy[i] = expected[i];
  sortArray(actualCopy, returnSize);
  sortArray(expectedCopy, expectedSize);
  bool passed = arraysEqual(actualCopy, returnSize, expectedCopy, expectedSize);
  printPrefix(index);
  printArray(expected, expectedSize);
  printf(",\\"actual\\":");
  printArray(actual, returnSize);
  printf(",\\"passed\\":%s}", passed ? "true" : "false");
  free(actualCopy);
  free(expectedCopy);
  free(actual);
}
`;
  }

  if (problemKey === 'binary-search') {
    return `
void runTest(int index, int* nums, int numsSize, int target, int expected) {
  int actual = solution(nums, numsSize, target);
  printPrefix(index);
  printf("%d,\\"actual\\":%d,\\"passed\\":%s}", expected, actual, actual == expected ? "true" : "false");
}
`;
  }

  return `
void runTest(int index, int input, int expected) {
  int actual = solution(input);
  printPrefix(index);
  printf("%d,\\"actual\\":%d,\\"passed\\":%s}", expected, actual, actual == expected ? "true" : "false");
}
`;
};

const buildCHarness = ({ code, question }) => {
  const tests = question.testCases.map((testCase, index) => {
    if (question.problemKey === 'two-sum') {
      return `int nums${index}[] = ${arrayLiteral(testCase.input[0])}; int expected${index}[] = ${arrayLiteral(testCase.expected)}; runTest(${index}, nums${index}, ${testCase.input[0].length}, ${testCase.input[1]}, expected${index}, ${testCase.expected.length});`;
    }
    if (question.problemKey === 'binary-search') {
      return `int nums${index}[] = ${arrayLiteral(testCase.input[0])}; runTest(${index}, nums${index}, ${testCase.input[0].length}, ${testCase.input[1]}, ${testCase.expected});`;
    }
    return `runTest(${index}, ${testCase.input[0]}, ${testCase.expected});`;
  }).join('\n  ');

  return `#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
${code}

void printArray(int* values, int size) {
  printf("[");
  for (int i = 0; i < size; i++) {
    if (i) printf(",");
    printf("%d", values[i]);
  }
  printf("]");
}

bool arraysEqual(int* a, int aSize, int* b, int bSize) {
  if (aSize != bSize) return false;
  for (int i = 0; i < aSize; i++) if (a[i] != b[i]) return false;
  return true;
}

void sortArray(int* values, int size) {
  for (int i = 0; i < size; i++) {
    for (int j = i + 1; j < size; j++) {
      if (values[j] < values[i]) {
        int temp = values[i];
        values[i] = values[j];
        values[j] = temp;
      }
    }
  }
}

void printPrefix(int index) {
  if (index) printf(",");
  printf("{\\"index\\":%d,\\"expected\\":", index);
}

${buildCRunner(question.problemKey)}

int main() {
  printf("[");
  ${tests}
  printf("]");
  return 0;
}
`;
};

const buildJavaRunner = (problemKey) => {
  if (problemKey === 'two-sum') {
    return `
  static void runTest(int index, int[] nums, int target, int[] expected) {
    int[] actual = candidate.solution(nums, target);
    int[] sortedActual = actual.clone();
    int[] sortedExpected = expected.clone();
    Arrays.sort(sortedActual);
    Arrays.sort(sortedExpected);
    printResult(index, arrayJson(expected), arrayJson(actual), Arrays.equals(sortedActual, sortedExpected));
  }
`;
  }

  if (problemKey === 'binary-search') {
    return `
  static void runTest(int index, int[] nums, int target, int expected) {
    int actual = candidate.solution(nums, target);
    printResult(index, String.valueOf(expected), String.valueOf(actual), actual == expected);
  }
`;
  }

  return `
  static void runTest(int index, int input, int expected) {
    int actual = candidate.solution(input);
    printResult(index, String.valueOf(expected), String.valueOf(actual), actual == expected);
  }
`;
};

const buildJavaHarness = ({ code, question }) => {
  const tests = question.testCases.map((testCase, index) => {
    if (question.problemKey === 'two-sum') {
      return `runTest(${index}, new int[]${arrayLiteral(testCase.input[0])}, ${testCase.input[1]}, new int[]${arrayLiteral(testCase.expected)});`;
    }
    if (question.problemKey === 'binary-search') {
      return `runTest(${index}, new int[]${arrayLiteral(testCase.input[0])}, ${testCase.input[1]}, ${testCase.expected});`;
    }
    return `runTest(${index}, ${testCase.input[0]}, ${testCase.expected});`;
  }).join('\n    ');

  return `import java.util.*;
${code}

public class Main {
  static Solution candidate = new Solution();

  static String arrayJson(int[] values) {
    StringBuilder out = new StringBuilder("[");
    for (int i = 0; i < values.length; i++) {
      if (i > 0) out.append(",");
      out.append(values[i]);
    }
    return out.append("]").toString();
  }

  static void printResult(int index, String expected, String actual, boolean passed) {
    if (index > 0) System.out.print(",");
    System.out.print("{\\"index\\":" + index + ",\\"expected\\":" + expected + ",\\"actual\\":" + actual + ",\\"passed\\":" + passed + "}");
  }

${buildJavaRunner(question.problemKey)}

  public static void main(String[] args) {
    System.out.print("[");
    ${tests}
    System.out.print("]");
  }
}
`;
};

const runCodeForQuestion = async ({ language, code, question }) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'interview-code-'));

  try {
    if (language === 'python') {
      const filePath = path.join(tempDir, 'solution.py');
      fs.writeFileSync(filePath, buildPythonHarness({ code, question }));
      const run = await execFileAsync('python', [filePath]);
      return run.ok ? { ok: true, results: normalizeRunOutput(run.stdout) } : { ok: false, message: run.stderr || run.error?.message || 'Python execution failed.' };
    }

    if (language === 'cpp') {
      const sourcePath = path.join(tempDir, 'solution.cpp');
      const exePath = path.join(tempDir, 'solution.exe');
      fs.writeFileSync(sourcePath, buildCppHarness({ code, question }));
      const compile = await execFileAsync('g++', ['-std=c++17', sourcePath, '-o', exePath]);
      if (!compile.ok) return { ok: false, message: compile.stderr || compile.error?.message || 'C++ compilation failed.' };
      const run = await execFileAsync(exePath, []);
      return run.ok ? { ok: true, results: normalizeRunOutput(run.stdout) } : { ok: false, message: run.stderr || run.error?.message || 'C++ execution failed.' };
    }

    if (language === 'c') {
      const sourcePath = path.join(tempDir, 'solution.c');
      const exePath = path.join(tempDir, 'solution.exe');
      fs.writeFileSync(sourcePath, buildCHarness({ code, question }));
      const compile = await execFileAsync('gcc', ['-std=c11', sourcePath, '-o', exePath]);
      if (!compile.ok) return { ok: false, message: compile.stderr || compile.error?.message || 'C compilation failed.' };
      const run = await execFileAsync(exePath, []);
      return run.ok ? { ok: true, results: normalizeRunOutput(run.stdout) } : { ok: false, message: run.stderr || run.error?.message || 'C execution failed.' };
    }

    if (language === 'java') {
      const sourcePath = path.join(tempDir, 'Main.java');
      fs.writeFileSync(sourcePath, buildJavaHarness({ code, question }));
      const compile = await execFileAsync('javac', [sourcePath]);
      if (!compile.ok) return { ok: false, message: compile.stderr || compile.error?.message || 'Java compilation failed.' };
      const run = await execFileAsync('java', ['-cp', tempDir, 'Main']);
      return run.ok ? { ok: true, results: normalizeRunOutput(run.stdout) } : { ok: false, message: run.stderr || run.error?.message || 'Java execution failed.' };
    }

    return { ok: false, message: 'Unsupported language.' };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const buildLocalQuestions = ({ level, counts, topicPlan = [] }) => {
  const topicsBySubject = topicPlanBySubject(topicPlan);

  return Object.keys(SUBJECT_LIMITS).flatMap((subject) => (
    getSubjectQuestionPool(subject, level).slice(0, counts[subject]).map((question, index) => ({
    id: `${subject}-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    subject,
    subjectLabel: SUBJECT_LIMITS[subject].label,
    level,
      topic: topicsBySubject[subject]?.topic || null,
    questionText: question.questionType === 'coding'
      ? question.prompt
      : `${question.prompt}${topicsBySubject[subject]?.topic ? ` Focus on ${topicsBySubject[subject].topic}.` : ''} Answer at a ${level.toLowerCase()} interview depth.`,
    keywords: question.keywords,
    questionType: question.questionType || 'text',
    problemKey: question.problemKey || null,
    title: question.title || '',
    description: question.description || '',
    constraints: question.constraints || [],
    codeTemplates: question.problemKey ? Object.fromEntries(Object.keys(CODE_TEMPLATES).map((language) => [language, getStarterCode(question.problemKey, language)])) : {},
    starterCode: question.problemKey ? getStarterCode(question.problemKey, 'python') : '',
      testCases: question.testCases || []
    }))
  ));
};

const buildLocalSubjectQuestions = ({ level, subject, count, topic = null }) => (
  getSubjectQuestionPool(subject, level).slice(0, count).map((question, index) => ({
    id: `${subject}-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    subject,
    subjectLabel: SUBJECT_LIMITS[subject].label,
    level,
    topic,
    questionText: question.questionType === 'coding'
      ? question.prompt
      : `${question.prompt}${topic ? ` Focus on ${topic}.` : ''} Answer at a ${level.toLowerCase()} interview depth.`,
    keywords: question.keywords,
    questionType: question.questionType || 'text',
    problemKey: question.problemKey || null,
    title: question.title || '',
    description: question.description || '',
    constraints: question.constraints || [],
    codeTemplates: question.problemKey ? Object.fromEntries(Object.keys(CODE_TEMPLATES).map((language) => [language, getStarterCode(question.problemKey, language)])) : {},
    starterCode: question.problemKey ? getStarterCode(question.problemKey, 'python') : '',
    testCases: question.testCases || []
  }))
);

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

const generateAiQuestions = async ({ level, counts, topicPlan = [] }) => {
  const topicsBySubject = topicPlanBySubject(topicPlan);
  const requested = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([subject, count]) => `${count} ${subject}${topicsBySubject[subject]?.topic ? ` focused on ${topicsBySubject[subject].topic}` : ''}`)
    .join(', ');

  const content = await callOpenAI([
    {
      role: 'system',
      content: 'You create interview practice questions. Return only valid JSON.'
    },
    {
      role: 'user',
      content: `Create unique ${level} questions for these counts: ${requested}. Use subjects OOP, OS, DBMS, DSA. If a subject has a topic focus, make the question specifically about that topic. For DSA prefer coding questions in JavaScript. Return {"questions":[{"subject":"OOP","questionText":"...","keywords":["..."],"questionType":"text"}]}. Keywords must be short lowercase scoring concepts.`
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
      topic: topicsBySubject[question.subject]?.topic || null,
      questionText: question.questionText,
      keywords: Array.isArray(question.keywords) ? question.keywords : [],
      questionType: question.questionType === 'coding' ? 'coding' : 'text',
      starterCode: question.starterCode || '',
      testCases: Array.isArray(question.testCases) ? question.testCases : []
    }));
};

const evaluateLocally = ({ answer, question }) => {
  if (question.questionType === 'coding') {
    let parsed = null;

    try {
      parsed = JSON.parse(answer);
    } catch {
      parsed = null;
    }

    const code = String(parsed?.code || answer);
    const testResults = Array.isArray(parsed?.testResults) ? parsed.testResults : [];
    const passed = testResults.filter((result) => result.passed).length;
    const total = testResults.length || question.testCases?.length || 0;
    const passRatio = total ? passed / total : 0;
    const hasFunction = /solution\s*\(/.test(code);
    const mentionsComplexity = /time|space|complexity|o\(/i.test(code);
    const score = Math.max(1, Math.min(10, Math.round((passRatio * 7) + (hasFunction ? 2 : 0) + (mentionsComplexity ? 1 : 0))));

    return {
      score,
      feedback: passRatio === 1
        ? 'Code passed the visible test cases. Review complexity, edge cases, and clarity before treating it as interview-ready.'
        : `Code passed ${passed} of ${total || question.testCases?.length || 0} visible test cases. Fix failing cases before moving on.`,
      strengths: [
        passRatio === 1 ? 'Visible test cases passed.' : `Passed ${passed} visible test ${passed === 1 ? 'case' : 'cases'}.`,
        hasFunction ? 'Solution function is present.' : 'Attempted a coding response.'
      ],
      improvements: passRatio === 1
        ? ['Explain time and space complexity in comments or after the code.', 'Consider hidden edge cases beyond the visible tests.']
        : ['Use the test output to fix incorrect return values or runtime errors.', 'Check edge cases and input shape carefully.']
    };
  }

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
  const evaluationPrompt = question.questionType === 'coding'
    ? `Coding question: ${question.questionText}\nCandidate submission JSON: ${answer}\nEvaluate code correctness, visible test results, complexity, edge cases, and readability from 1 to 10. Return {"score":number,"feedback":"...","strengths":["..."],"improvements":["..."]}.`
    : `Question: ${question.questionText}\nCandidate answer: ${answer}\nEvaluate from 1 to 10. Return {"score":number,"feedback":"...","strengths":["..."],"improvements":["..."]}.`;

  const content = await callOpenAI([
    {
      role: 'system',
      content: 'You are a strict but helpful technical interviewer. Return only valid JSON.'
    },
    {
      role: 'user',
      content: evaluationPrompt
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

const getFollowUpFocus = ({ answer, question, evaluation }) => {
  const text = `${question.questionText} ${answer}`.toLowerCase();
  const improvements = evaluation?.improvements?.[0] || 'Add a concrete edge case or tradeoff.';

  if (/binary\s*search|sorted|mid|left|right/.test(text)) {
    return {
      prompt: 'You mentioned binary search. Walk me through the edge cases that can break a binary search implementation, and explain how you would avoid an infinite loop.',
      keywords: ['edge', 'case', 'mid', 'overflow', 'left', 'right', 'loop', 'sorted', 'complexity']
    };
  }

  if (/complexity|time|space|big\s*o|o\(/.test(text)) {
    return {
      prompt: `You discussed complexity. Can you justify the time and space complexity more rigorously, including the best, average, and worst case when they differ?`,
      keywords: ['time', 'space', 'best', 'average', 'worst', 'complexity', 'tradeoff']
    };
  }

  if (/example|application|real|scenario|system/.test(text)) {
    return {
      prompt: 'Take the practical example you gave and explain what would change if the input size, concurrency, or failure cases increased significantly.',
      keywords: ['scale', 'input', 'concurrency', 'failure', 'tradeoff', 'design']
    };
  }

  if (/deadlock|mutex|semaphore|thread|process/.test(text)) {
    return {
      prompt: 'Let us go one level deeper: what edge case or failure mode would you watch for in this operating-system scenario, and how would you prevent it?',
      keywords: ['deadlock', 'race', 'starvation', 'synchronization', 'prevention', 'edge']
    };
  }

  if (/index|transaction|join|normalization|sql|database/.test(text)) {
    return {
      prompt: 'Suppose this database design is under heavy production traffic. What tradeoffs would you consider around consistency, indexing, and query performance?',
      keywords: ['consistency', 'index', 'query', 'transaction', 'performance', 'tradeoff']
    };
  }

  return {
    prompt: `I want to probe your depth on that answer. ${improvements} Can you refine your explanation with one edge case, one tradeoff, and one practical example?`,
    keywords: ['edge', 'tradeoff', 'example', 'complexity', 'practical', 'reasoning']
  };
};

const generateAiFollowUp = async ({ answer, question, evaluation }) => {
  const content = await callOpenAI([
    {
      role: 'system',
      content: 'You are a technical interviewer. Return only valid JSON.'
    },
    {
      role: 'user',
      content: `Original question: ${question.questionText}\nCandidate answer: ${answer}\nEvaluation: ${evaluation.feedback}\nStrengths: ${(evaluation.strengths || []).join('; ')}\nImprovements: ${(evaluation.improvements || []).join('; ')}\nCreate one contextual follow-up question that tests depth, edge cases, complexity, or practical application. Return {"questionText":"...","keywords":["..."]}.`
    }
  ], 0.35);

  if (!content) return null;

  const parsed = parseJsonObject(content);
  if (!parsed?.questionText) return null;

  return {
    prompt: parsed.questionText,
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10) : []
  };
};

const buildFollowUpQuestion = async ({ answer, question, evaluation }) => {
  let followUp = null;

  try {
    followUp = await generateAiFollowUp({ answer, question, evaluation });
  } catch (err) {
    console.error(`AI follow-up generation failed: ${err.message}`);
  }

  if (!followUp) {
    followUp = getFollowUpFocus({ answer, question, evaluation });
  }

  return {
    id: `followup-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    subject: question.subject,
    subjectLabel: question.subjectLabel,
    level: question.level,
    questionText: followUp.prompt,
    keywords: followUp.keywords,
    isFollowUp: true,
    parentQuestionId: question.dbQuestionId
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
    questionType: question.questionType || 'text',
    problemKey: question.problemKey || null,
    title: question.title || '',
    description: question.description || '',
    constraints: question.constraints || [],
    codeTemplates: question.codeTemplates || {},
    starterCode: question.starterCode || '',
    testCases: question.testCases || [],
    isFollowUp: Boolean(question.isFollowUp),
    parentQuestionId: question.parentQuestionId || null,
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
    topic: 'Binary Search',
    subject: 'DSA',
    sheetKey: 'DSA',
    keywords: ['binary', 'search', 'sorted', 'mid', 'left', 'right', 'log']
  },
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
    topic: 'Concurrency',
    subject: 'OS',
    sheetKey: 'OS',
    keywords: ['thread', 'mutex', 'semaphore', 'race', 'synchronization', 'starvation']
  },
  {
    topic: 'Normalization',
    subject: 'DBMS',
    sheetKey: 'DBMS',
    keywords: ['normalization', '3nf', 'dependency', 'redundancy', 'anomaly']
  },
  {
    topic: 'Indexing',
    subject: 'DBMS',
    sheetKey: 'DBMS',
    keywords: ['index', 'query', 'performance', 'b-tree', 'slow', 'optimize']
  },
  {
    topic: 'OOP Design',
    subject: 'OOP',
    sheetKey: 'OOP',
    keywords: ['inheritance', 'composition', 'polymorphism', 'abstraction', 'encapsulation', 'solid']
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

const formatTrendDate = (value) => new Date(value).toISOString().slice(0, 10);

const getSavedResume = async (userId) => {
  const result = await pool.query('SELECT parsed FROM resumes WHERE user_id = $1', [userId]);
  return result.rows[0]?.parsed || null;
};

const firstItems = (items, count) => (Array.isArray(items) ? items.filter(Boolean).slice(0, count) : []);

const buildResumeQuestions = ({ resume, level, count }) => {
  const skills = firstItems(resume?.skills, 8);
  const projects = firstItems(resume?.projects, 5);
  const experience = firstItems(resume?.experience, 5);
  const achievements = firstItems(resume?.achievements, 4);
  const education = firstItems(resume?.education, 3);
  const questions = [];

  projects.forEach((project, index) => {
    questions.push({
      id: `resume-project-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      subject: 'RESUME',
      subjectLabel: 'Resume-Based',
      level,
      questionText: `Your resume mentions this project: "${project}". Explain the problem, your exact contribution, the technology choices, one challenge, and the measurable outcome.`,
      keywords: ['project', 'contribution', 'technology', 'challenge', 'outcome', ...skills.slice(0, 4)]
    });
  });

  experience.forEach((item, index) => {
    questions.push({
      id: `resume-experience-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      subject: 'RESUME',
      subjectLabel: 'Resume-Based',
      level,
      questionText: `Walk me through this experience from your resume: "${item}". What did you own, how did you make decisions, and what would you improve if you did it again?`,
      keywords: ['experience', 'ownership', 'decision', 'impact', 'improve', ...skills.slice(0, 4)]
    });
  });

  if (skills.length) {
    questions.push({
      id: `resume-skills-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      subject: 'RESUME',
      subjectLabel: 'Resume-Based',
      level,
      questionText: `Your resume lists these skills: ${skills.join(', ')}. Pick two and explain where you used them deeply, including tradeoffs and edge cases.`,
      keywords: ['skills', 'tradeoff', 'edge', 'used', ...skills.slice(0, 8)]
    });
  }

  achievements.forEach((item, index) => {
    questions.push({
      id: `resume-achievement-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      subject: 'RESUME',
      subjectLabel: 'Resume-Based',
      level,
      questionText: `Tell me about this achievement: "${item}". Why was it meaningful, what was difficult, and what does it show about your strengths?`,
      keywords: ['achievement', 'difficult', 'meaningful', 'strength', 'result']
    });
  });

  if (education.length) {
    questions.push({
      id: `resume-education-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      subject: 'RESUME',
      subjectLabel: 'Resume-Based',
      level,
      questionText: `Based on your education entry "${education[0]}", which CS fundamentals are strongest for you and which one do you still need to improve?`,
      keywords: ['education', 'fundamentals', 'strong', 'improve']
    });
  }

  if (!questions.length) {
    questions.push({
      id: `resume-general-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      subject: 'RESUME',
      subjectLabel: 'Resume-Based',
      level,
      questionText: 'Summarize your resume, then explain the strongest project or experience you want an interviewer to remember.',
      keywords: ['resume', 'project', 'experience', 'impact', 'skills']
    });
  }

  return shuffle(questions).slice(0, count);
};

router.post('/start', authMiddleware, async (req, res) => {
  const level = LEVELS.includes(req.body.level) ? req.body.level : null;
  const interviewType = INTERVIEW_TYPES.includes(req.body.interviewType) ? req.body.interviewType : 'Core Subjects';
  const resumeQuestionCount = Math.max(1, Math.min(10, Number(req.body.resumeQuestionCount || 3)));
  const topicPlan = normalizeTopicPlan(req.body.topicPlan);
  const counts = {};

  ['OOP', 'OS', 'DBMS', 'DSA'].forEach((subject) => {
    const topicEntry = topicPlan.find((entry) => entry.subject === subject);
    counts[subject] = topicEntry ? topicEntry.count : clampCount(req.body.counts?.[subject] ?? 0, subject);
  });
  counts.RESUME = interviewType === 'Resume-Based'
    ? resumeQuestionCount
    : interviewType === 'Mixed'
      ? Math.min(3, resumeQuestionCount)
      : 0;

  if (!level || ['OOP', 'OS', 'DBMS', 'DSA'].some((subject) => counts[subject] === null)) {
    return res.status(400).json({ message: 'Choose a valid level and question count.' });
  }

  const coreQuestionCount = ['OOP', 'OS', 'DBMS', 'DSA'].reduce((total, subject) => total + counts[subject], 0);
  const totalQuestions = interviewType === 'Resume-Based'
    ? counts.RESUME
    : coreQuestionCount + counts.RESUME;

  if (totalQuestions < 1) {
    return res.status(400).json({ message: 'Select at least one question.' });
  }

  if (interviewType === 'Resume-Based' && counts.RESUME < 1) {
    return res.status(400).json({ message: 'Choose at least one resume-based question.' });
  }

  try {
    let questions = null;
    let resumeQuestions = [];

    if (interviewType !== 'Core Subjects') {
      const resume = await getSavedResume(req.user.id);

      if (!resume) {
        return res.status(400).json({ message: 'Upload and save a resume before starting a resume-based interview.' });
      }

      resumeQuestions = buildResumeQuestions({ resume, level, count: counts.RESUME });
    }

    const coreCounts = interviewType === 'Resume-Based'
      ? { OOP: 0, OS: 0, DBMS: 0, DSA: 0 }
      : { OOP: counts.OOP, OS: counts.OS, DBMS: counts.DBMS, DSA: counts.DSA };

    if (coreQuestionCount > 0 && interviewType !== 'Resume-Based') {
      try {
        questions = await generateAiQuestions({ level, counts: coreCounts, topicPlan });
      } catch (err) {
        console.error(`AI question generation failed: ${err.message}`);
      }
    }

    if (!questions || questions.length !== coreQuestionCount) {
        questions = buildLocalQuestions({ level, counts: coreCounts, topicPlan });
    } else if (coreCounts.DSA > 0) {
        const localDsaQuestions = buildLocalSubjectQuestions({ level, subject: 'DSA', count: coreCounts.DSA, topic: topicPlanBySubject(topicPlan).DSA?.topic || null });
      questions = [
        ...questions.filter((question) => question.subject !== 'DSA'),
        ...localDsaQuestions
      ];
    }

    const orderedQuestions = shuffle([...questions, ...resumeQuestions]);
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
        [req.user.id, interviewId, interviewType, level, orderedQuestions.length]
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
          dbQuestionId: questionResult.rows[0].id,
          position: index + 1
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
      interviewType,
      counts,
      topicPlan,
      currentIndex: 0,
      questions: persistedQuestions,
      answers: [],
      followUpsAsked: 0,
      maxFollowUps: Math.min(orderedQuestions.length, 6),
      startedAt: new Date().toISOString()
    };

    sessions.set(String(session.id), session);

    res.status(201).json({
      interviewId: session.id,
      level,
      interviewType,
      totalQuestions,
      question: getCurrentQuestion(session),
      provider: process.env.OPENAI_API_KEY ? 'ai' : 'local'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error. Check that PostgreSQL is running and the database tables are created.' });
  }
});

router.post('/:id/run-code', authMiddleware, async (req, res) => {
  const session = sessions.get(String(req.params.id));
  const language = String(req.body.language || '').toLowerCase();
  const code = String(req.body.code || '');
  const testCases = Array.isArray(req.body.testCases) && req.body.testCases.length
    ? req.body.testCases
    : null;

  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ message: 'Interview session not found. Please start a new interview.' });
  }

  const question = session.questions[session.currentIndex];

  if (!question || question.questionType !== 'coding') {
    return res.status(400).json({ message: 'Current question is not a coding question.' });
  }

  if (!['c', 'cpp', 'python', 'java'].includes(language)) {
    return res.status(400).json({ message: 'Choose C, C++, Python, or Java.' });
  }

  if (!code.trim()) {
    return res.status(400).json({ message: 'Write code before running test cases.' });
  }

  try {
    const result = await runCodeForQuestion({
      language,
      code,
      question: {
        ...question,
        testCases: testCases || question.testCases
      }
    });

    if (!result.ok) {
      return res.status(200).json({
        ok: false,
        message: result.message,
        results: []
      });
    }

    res.json({
      ok: true,
      message: `${result.results.filter((item) => item.passed).length} of ${result.results.length} visible tests passed.`,
      results: result.results
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to run code.' });
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

    const shouldAskFollowUp = !question.isFollowUp && session.followUpsAsked < session.maxFollowUps;
    let followUpQuestion = null;

    if (shouldAskFollowUp) {
      followUpQuestion = await buildFollowUpQuestion({ answer, question, evaluation });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
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

      if (followUpQuestion) {
        await client.query(
          `UPDATE interview_questions
           SET position = position + 1
           WHERE session_id = $1 AND position > $2`,
          [session.id, question.position]
        );

        const followUpResult = await client.query(
          `INSERT INTO interview_questions
            (session_id, subject, subject_label, question_text, level, position, keywords)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            session.id,
            followUpQuestion.subject,
            followUpQuestion.subjectLabel,
            followUpQuestion.questionText,
            followUpQuestion.level,
            question.position + 1,
            JSON.stringify(followUpQuestion.keywords || [])
          ]
        );

        followUpQuestion.dbQuestionId = followUpResult.rows[0].id;
        followUpQuestion.position = question.position + 1;

        session.questions.forEach((item) => {
          if (item.position > question.position) {
            item.position += 1;
          }
        });

        await client.query(
          `UPDATE interview_sessions
           SET total_questions = total_questions + 1
           WHERE id = $1 AND user_id = $2`,
          [session.id, req.user.id]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    session.answers.push({
      questionId: question.id,
      dbQuestionId: question.dbQuestionId,
      subject: question.subject,
      answer,
      evaluation
    });

    if (followUpQuestion) {
      session.questions.splice(session.currentIndex + 1, 0, followUpQuestion);
      session.followUpsAsked += 1;
    }

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
    const sessionTrendResult = await pool.query(
      `SELECT
        id,
        level,
        average_score,
        started_at,
        completed_at
       FROM interview_sessions
       WHERE user_id = $1 AND average_score IS NOT NULL
       ORDER BY COALESCE(completed_at, started_at) ASC
       LIMIT 30`,
      [req.user.id]
    );

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
        a.score,
        a.answered_at,
        s.id AS session_id
       FROM interview_answers a
       JOIN interview_questions q ON q.id = a.question_id
       JOIN interview_sessions s ON s.id = q.session_id
       WHERE s.user_id = $1`,
      [req.user.id]
    );

    const subjectRows = new Map(subjectResult.rows.map((row) => [row.subject, row]));
    const scoreTrend = sessionTrendResult.rows.map((session, index, rows) => {
      const score = Number(session.average_score) * 10;
      const previousScore = index > 0 ? Number(rows[index - 1].average_score) * 10 : null;

      return {
        sessionId: session.id,
        label: `#${session.id}`,
        level: session.level,
        date: formatTrendDate(session.completed_at || session.started_at),
        score: Math.round(score),
        change: previousScore === null ? null : Math.round(score - previousScore)
      };
    });

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

    const subjectComparisons = subjects
      .map((subject) => ({
        ...subject,
        gap: Math.round((subject.sheetProgress || 0) - (subject.interviewScore || 0))
      }))
      .sort((a, b) => b.rating - a.rating);

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

    const firstScore = scoreTrend[0]?.score ?? null;
    const latestScore = scoreTrend[scoreTrend.length - 1]?.score ?? null;
    const bestScore = scoreTrend.length ? Math.max(...scoreTrend.map((item) => item.score)) : null;
    const recentScores = scoreTrend.slice(-3);
    const earlierScores = scoreTrend.slice(0, Math.max(0, scoreTrend.length - 3));
    const recentAverage = recentScores.length
      ? Math.round(recentScores.reduce((total, item) => total + item.score, 0) / recentScores.length)
      : null;
    const earlierAverage = earlierScores.length
      ? Math.round(earlierScores.reduce((total, item) => total + item.score, 0) / earlierScores.length)
      : null;

    const improvementHistory = {
      firstScore,
      latestScore,
      bestScore,
      totalSessions: scoreTrend.length,
      netChange: firstScore === null || latestScore === null ? null : latestScore - firstScore,
      recentAverage,
      recentChange: recentAverage === null || earlierAverage === null ? null : recentAverage - earlierAverage,
      message: scoreTrend.length < 2
        ? 'Complete more interviews to reveal score movement.'
        : `${latestScore >= firstScore ? 'Improved' : 'Changed'} ${Math.abs(latestScore - firstScore)} points from first to latest saved interview.`
    };

    const strongTopics = topics.filter((topic) => topic.rating >= 70).sort((a, b) => b.rating - a.rating).slice(0, 3);
    const weakTopics = topics.filter((topic) => topic.rating < 70).slice(0, 4);

    res.json({
      subjects,
      subjectComparisons,
      weakAreas: topics,
      weakTopics,
      strongTopics,
      scoreTrend,
      improvementHistory,
      lowestSubjects: subjects.slice(0, 3),
      recommendation: weakTopics.length > 0
        ? `Prioritize ${weakTopics[0].topic} next.`
        : 'Complete one interview and mark sheet progress to unlock better recommendations.'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Unable to build weakness analytics.' });
  }
});

module.exports = router;

