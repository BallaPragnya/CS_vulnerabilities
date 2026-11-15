/**
 * settings.js  (backend/routes/settings.js)
 * 
 * User settings module routes.
 * Phase 1: Returns current user profile; allows display name update.
 * Phase 2: Broken access control and mass assignment vulnerabilities will be added.
 * 
 * Routes:
 *   GET  /api/settings/profile         – get current user profile
 *   POST /api/settings/update-profile  – update display name / email
 */

const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { requireLogin } = require('../middleware/authMiddleware');

// ── GET /api/settings/profile ────────────────────────────────────────────────
// Returns the logged-in user's profile from the users table.
router.get('/profile', requireLogin, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, role, full_name, email, created_at FROM users WHERE id = ?'
  ).get(req.session.user.id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  return res.json({ success: true, profile: user });
});

// ── POST /api/settings/update-profile ───────────────────────────────────────
// Allows the logged-in user to update their display name and email.
router.post('/update-profile', requireLogin, (req, res) => {
  const { full_name, email } = req.body;

  if (!full_name || !email) {
    return res.status(400).json({ success: false, message: 'Name and email are required.' });
  }

  db.prepare(
    'UPDATE users SET full_name = ?, email = ? WHERE id = ?'
  ).run(full_name.trim(), email.trim(), req.session.user.id);

  // Update the session so the nav reflects the new name immediately
  req.session.user.full_name = full_name.trim();
  req.session.user.email     = email.trim();

  return res.json({ success: true, message: 'Profile updated successfully.' });
});

module.exports = router;
