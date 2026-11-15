/**
 * comments.js  (backend/routes/comments.js)
 *
 * Student comments / feedback module.
 *
 * Routes:
 *   GET  /api/comments  – return all comments (newest first)
 *   POST /api/comments  – post a new comment (requires login)
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../database');
const { requireLogin } = require('../middleware/authMiddleware');

// ── GET /api/comments ────────────────────────────────────────────────────────
// Returns all comments ordered by most recent first.
router.get('/', requireLogin, (req, res) => {
  const comments = db.prepare(
    'SELECT id, username, comment_text, created_at FROM comments ORDER BY created_at DESC'
  ).all();

  return res.json({ success: true, comments });
});

// ── POST /api/comments ───────────────────────────────────────────────────────
// Adds a new comment from the currently logged-in user.
// Body: { comment_text }
router.post('/', requireLogin, (req, res) => {
  const { comment_text } = req.body;

  if (!comment_text || !comment_text.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Comment text cannot be empty.'
    });
  }

  if (comment_text.trim().length > 500) {
    return res.status(400).json({
      success: false,
      message: 'Comment must be 500 characters or fewer.'
    });
  }

  db.prepare(
    'INSERT INTO comments (student_id, username, comment_text) VALUES (?, ?, ?)'
  ).run(req.session.user.id, req.session.user.username, comment_text.trim());

  // Log the comment action
  db.prepare(
    'INSERT INTO audit_log (username, action, target, ip_address) VALUES (?, ?, ?, ?)'
  ).run(req.session.user.username, 'COMMENT', '', req.ip || '');

  return res.status(201).json({
    success: true,
    message: 'Comment posted successfully.'
  });
});

module.exports = router;
