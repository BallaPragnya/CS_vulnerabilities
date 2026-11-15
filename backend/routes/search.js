/**
 * search.js  (backend/routes/search.js)
 *
 * Search module routes.
 * Phase 1: Returns filtered student + announcement list based on a query string.
 * Phase 2: SQL injection vulnerability demonstration will be added.
 *
 * Routes:
 *   GET /api/search?q=term  – search students and announcements
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../database');
const { requireLogin } = require('../middleware/authMiddleware');

// ── GET /api/search ──────────────────────────────────────────────────────────
// Searches the students table AND the announcements table by keyword.
// Returns { students, announcements } so the frontend can render both sections.
// Uses safe parameterized queries in Phase 1.
router.get('/', requireLogin, (req, res) => {
  const query = req.query.q || '';

  if (!query.trim()) {
    return res.json({
      success: true,
      students: [],
      announcements: [],
      message: 'Enter a search term.'
    });
  }

  // Phase 1: Safe parameterized queries
  const pattern = `%${query}%`;

  const students = db.prepare(`
    SELECT id, student_id, full_name, email, department, year, gpa
    FROM   students
    WHERE  full_name LIKE ? OR email LIKE ? OR department LIKE ?
  `).all(pattern, pattern, pattern);

  const announcements = db.prepare(`
    SELECT id, title, description, category, icon, created_at
    FROM   announcements
    WHERE  title LIKE ? OR description LIKE ? OR category LIKE ?
  `).all(pattern, pattern, pattern);

  return res.json({ success: true, students, announcements, query });
});

module.exports = router;
