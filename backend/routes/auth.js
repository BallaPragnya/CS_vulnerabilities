/**
 * auth.js  (backend/routes/auth.js)
 * 
 * Handles user authentication:
 *   POST /api/auth/login   – validate credentials, start session
 *   POST /api/auth/logout  – destroy session
 *   GET  /api/auth/me      – return current session user info
 */

const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { requireLogin } = require('../middleware/authMiddleware');

// ── POST /api/auth/login ────────────────────────────────────────────────────
// Accepts { username, password } in the request body.
// On success: saves user info to session and returns user data.
// On failure: returns HTTP 401 with an error message.
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Basic input validation – both fields are required
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required.'
    });
  }

  // Look up the user in the database
  // NOTE: This uses a parameterized query (safe from SQL injection)
  const user = db.prepare(
    'SELECT id, username, role, full_name, email FROM users WHERE username = ? AND password = ?'
  ).get(username.trim(), password);

  // If no user found, return 401 Unauthorized
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid username or password.'
    });
  }

  // Store user info in the session (session is managed by express-session)
  req.session.user = {
    id:        user.id,
    username:  user.username,
    role:      user.role,
    full_name: user.full_name,
    email:     user.email
  };

  // Log this login action to the audit log
  db.prepare(
    'INSERT INTO audit_log (username, action, target, ip_address) VALUES (?, ?, ?, ?)'
  ).run(user.username, 'LOGIN', '', req.ip || '');

  // Return the user data to the frontend
  return res.json({
    success: true,
    message: `Welcome, ${user.full_name}!`,
    user: req.session.user
  });
});

// ── POST /api/auth/logout ───────────────────────────────────────────────────
// Destroys the current session and logs the logout action.
router.post('/logout', (req, res) => {
  if (req.session && req.session.user) {
    // Log the logout before destroying the session
    db.prepare(
      'INSERT INTO audit_log (username, action, target, ip_address) VALUES (?, ?, ?, ?)'
    ).run(req.session.user.username, 'LOGOUT', '', req.ip || '');
  }

  // Destroy the session on the server side
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Could not log out. Please try again.' });
    }
    // Clear the session cookie from the browser
    res.clearCookie('campusconnect.sid');
    return res.json({ success: true, message: 'Logged out successfully.' });
  });
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────
// Returns the currently logged-in user's session data.
// Protected by requireLogin middleware – returns 401 if not authenticated.
router.get('/me', requireLogin, (req, res) => {
  return res.json({
    success: true,
    user: req.session.user
  });
});

module.exports = router;
