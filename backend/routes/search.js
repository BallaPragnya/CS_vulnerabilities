/**
 * search.js  (backend/routes/search.js)
 * 
 * Search module routes.
 * Phase 1: Returns filtered student list based on a query string.
 * Phase 2: SQL injection vulnerability demonstration will be added.
 * 
 * Routes:
 *   GET /api/search?q=term  – search students by name or email
 */

const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { requireLogin } = require('../middleware/authMiddleware');

// ── GET /api/search ──────────────────────────────────────────────────────────
// Searches the students table by name, email, or department.
// Uses a safe parameterized query in Phase 1.
router.get('/', requireLogin, (req, res) => {
  const query = req.query.q || '';

  if (!query.trim()) {
    return res.json({ success: true, results: [], message: 'Enter a search term.' });
  }

  // Phase 1: Safe parameterized query
  const pattern = `%${query}%`;
  const results = db.prepare(`
    SELECT id, student_id, full_name, email, department, year, gpa
    FROM students
    WHERE full_name LIKE ? OR email LIKE ? OR department LIKE ?
  `).all(pattern, pattern, pattern);

  return res.json({ success: true, results, query });
});

module.exports = router;
