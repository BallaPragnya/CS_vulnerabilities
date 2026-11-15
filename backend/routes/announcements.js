/**
 * announcements.js  (backend/routes/announcements.js)
 *
 * Campus announcements module.
 *
 * Routes:
 *   GET /api/announcements       – return all announcements (newest first)
 *   GET /api/announcements/:id   – return a single announcement by ID
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../database');
const { requireLogin } = require('../middleware/authMiddleware');

// ── GET /api/announcements ───────────────────────────────────────────────────
// Returns all announcements ordered by most recent first.
router.get('/', requireLogin, (req, res) => {
  const announcements = db.prepare(
    'SELECT id, title, description, category, icon, created_at FROM announcements ORDER BY created_at DESC'
  ).all();

  return res.json({ success: true, announcements });
});

// ── GET /api/announcements/:id ───────────────────────────────────────────────
// Returns a single announcement by its ID.
router.get('/:id', requireLogin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: 'Invalid announcement ID.' });
  }

  const announcement = db.prepare(
    'SELECT id, title, description, category, icon, created_at FROM announcements WHERE id = ?'
  ).get(id);

  if (!announcement) {
    return res.status(404).json({ success: false, message: 'Announcement not found.' });
  }

  return res.json({ success: true, announcement });
});

module.exports = router;
