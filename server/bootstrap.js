const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('./db');

let schemaInitPromise = null;

const splitSqlStatements = (sqlText) => {
  const cleaned = sqlText
    .replace(/--.*$/gm, '')
    .trim();

  return cleaned
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
};

const initializeSchema = async () => {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      const schemaPath = path.join(__dirname, 'init.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      const statements = splitSqlStatements(schemaSql);

      for (const statement of statements) {
        await pool.query(statement);
      }
    })().catch((error) => {
      schemaInitPromise = null;
      throw error;
    });
  }

  return schemaInitPromise;
};

const ensureAdminAccount = async () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

  const adminName = process.env.ADMIN_NAME || 'Admin';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await pool.query(
    `
      INSERT INTO users (name, email, password_hash, role, status)
      VALUES ($1, $2, $3, 'admin', 'active')
      ON CONFLICT (email)
      DO UPDATE SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = 'admin',
        status = 'active'
    `,
    [adminName, adminEmail, passwordHash]
  );
};

module.exports = {
  initializeSchema,
  ensureAdminAccount
};