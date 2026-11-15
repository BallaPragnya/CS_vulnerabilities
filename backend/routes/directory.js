/**
 * directory.js  (backend/routes/directory.js)
 *
 * Student Directory module.
 *
 * Routes:
 *   GET  /api/directory              – list all students (safe)
 *   GET  /api/directory/search       – search students (safe, parameterised)
 *
 * ── SECURITY LAB ROUTES (SQL Injection – UNION-based extraction) ──────────
 *   POST /api/directory/search-vuln  – VULNERABLE search (string concatenation)
 *   POST /api/directory/search-safe  – SECURE search (parameterised query)
 */

const express = require('express');
const router  = express.Router();
const { db, dangerousRawQuery } = require('../database');
const { requireLogin }          = require('../middleware/authMiddleware');

// ── GET /api/directory ───────────────────────────────────────────────────────
// Returns all student records – used by the directory page initial load.
router.get('/', requireLogin, (req, res) => {
  const students = db.prepare(
    'SELECT student_id, full_name, email, department, year, gpa FROM students ORDER BY full_name ASC'
  ).all();
  return res.json({ success: true, students });
});

// ── GET /api/directory/search ────────────────────────────────────────────────
// SAFE search used by normal directory page. Uses parameterised query.
router.get('/search', requireLogin, (req, res) => {
  const name = req.query.name || '';
  const students = db.prepare(
    // ? placeholder prevents any SQL injection
    'SELECT student_id, full_name, email, department, year, gpa FROM students WHERE full_name LIKE ?'
  ).all(`%${name}%`);
  return res.json({ success: true, students });
});

// ════════════════════════════════════════════════════════════════════════════
// SECURITY LAB: SQL INJECTION – UNION-BASED DATA EXTRACTION
// ════════════════════════════════════════════════════════════════════════════

// ── POST /api/directory/search-vuln ──────────────────────────────────────────
//
// ⚠️  VULNERABLE MODE: User input is directly concatenated into the SQL query.
//
// This allows an attacker to append a UNION SELECT statement to the original
// query, causing the database to return data from a completely different table
// (e.g., the users table) alongside the legitimate results.
//
// Example payload:
//   ' UNION SELECT username, password, role, email, 1, 1 FROM users --
//
// What happens:
//   The original query selects 6 columns from students.
//   The UNION SELECT appends 6 more columns from users.
//   The combined result is returned, leaking usernames and passwords.
//
router.post('/search-vuln', requireLogin, (req, res) => {
  const { name = '' } = req.body;

  // ► THE VULNERABLE LINE: user input concatenated directly into SQL
  const sql = `SELECT student_id, full_name, email, department, year, gpa `
            + `FROM students WHERE full_name LIKE '%${name}%'`;

  let rows       = [];
  let queryError = null;

  try {
    // Execute the raw un-parameterised SQL string
    rows = dangerousRawQuery(sql);
  } catch (err) {
    queryError = err.message;
  }

  // Log this demo attempt to the audit trail
  db.prepare(
    'INSERT INTO audit_log (username, action, target, ip_address) VALUES (?, ?, ?, ?)'
  ).run(req.session.user.username, 'SQLI_UNION_DEMO_VULN', name.substring(0, 60), req.ip || '');

  return res.json({
    mode:           'vulnerable',
    success:        !queryError,
    constructedSql: sql,
    rows,
    rowCount:       rows.length,
    queryError,
    explanation:    queryError
      ? `💥 SQL error: ${queryError}`
      : rows.length > 0
        ? `⚠️ ${rows.length} row(s) returned. If a UNION payload was used, data from other tables may be included.`
        : '🔍 No rows matched the search term.'
  });
});

// ── POST /api/directory/search-safe ──────────────────────────────────────────
//
// ✅  SECURE MODE: Parameterised query with ? placeholder.
//
// Even if the attacker types:
//   ' UNION SELECT username, password, role, email, 1, 1 FROM users --
//
// The database driver treats the entire string as a literal search value.
// It searches for a student whose full_name literally contains that string.
// No such student exists → empty result.  The UNION never executes.
//
router.post('/search-safe', requireLogin, (req, res) => {
  const { name = '' } = req.body;

  // ► THE SECURE LINE: ? placeholder, value bound separately
  const rows = db.prepare(
    'SELECT student_id, full_name, email, department, year, gpa FROM students WHERE full_name LIKE ?'
  ).all(`%${name}%`);  // the % wildcards are added in the JS layer, not SQL

  // Log this demo attempt
  db.prepare(
    'INSERT INTO audit_log (username, action, target, ip_address) VALUES (?, ?, ?, ?)'
  ).run(req.session.user.username, 'SQLI_UNION_DEMO_SAFE', name.substring(0, 60), req.ip || '');

  return res.json({
    mode:           'secure',
    success:        true,
    // Show the SQL template only – never reflect user input back into SQL
    constructedSql: `SELECT student_id, full_name, email, department, year, gpa\nFROM students WHERE full_name LIKE ?`,
    parameterValues: [`%${name}%`],
    rows,
    rowCount:       rows.length,
    explanation:    rows.length > 0
      ? `✅ ${rows.length} student(s) found safely. UNION injection cannot work with parameterised queries.`
      : `🛡️ No students matched. If a UNION payload was entered, it was treated as a literal string and blocked.`
  });
});

module.exports = router;
