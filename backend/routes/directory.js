/**
 * directory.js  (backend/routes/directory.js)
 * 
 * Student directory module routes.
 * Phase 1: Returns sample data so the frontend page loads correctly.
 * Phase 2: Full CRUD with vulnerability demonstrations will be added here.
 * 
 * Routes:
 *   GET  /api/directory         – list all students
 *   GET  /api/directory/:id     – get one student by ID
 */

const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { requireLogin } = require('../middleware/authMiddleware');

// ── GET /api/directory ───────────────────────────────────────────────────────
// Returns a list of all student records.
// Requires the user to be logged in.
router.get('/', requireLogin, (req, res) => {
  const students = db.prepare('SELECT * FROM students ORDER BY full_name ASC').all();
  return res.json({ success: true, students });
});

// ── GET /api/directory/:id ───────────────────────────────────────────────────
// Returns a single student record by their row ID.
router.get('/:id', requireLogin, (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found.' });
  }
  return res.json({ success: true, student });
});

module.exports = router;
