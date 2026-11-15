/**
 * auth.js  (backend/routes/auth.js)
 *
 * Handles user authentication:
 *   POST /api/auth/login    – validate credentials with bcrypt, start session
 *   POST /api/auth/logout   – destroy session
 *   GET  /api/auth/me       – return current session user info
 *   POST /api/auth/register – register a new student account
 */

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const { db }  = require('../database');
const { requireLogin } = require('../middleware/authMiddleware');

const SALT_ROUNDS = 10;

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

  // Look up the user in the database (fetch the row WITHOUT the password filter
  // so we can compare the hash with bcrypt.compareSync)
  const user = db.prepare(
    'SELECT id, username, password, role, full_name, email FROM users WHERE username = ?'
  ).get(username.trim());

  // Verify password against the stored bcrypt hash
  if (!user || !bcrypt.compareSync(password, user.password)) {
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

// ── POST /api/auth/register ─────────────────────────────────────────────────
// Accepts { full_name, username, email, password } in the request body.
// Creates a new student account with a bcrypt-hashed password.
router.post('/register', (req, res) => {
  const { full_name, username, email, password } = req.body;

  // ── Validation ────────────────────────────────────────────────────────────
  if (!full_name || !username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'All fields (full name, username, email, password) are required.'
    });
  }

  if (username.trim().length < 3 || username.trim().length > 20) {
    return res.status(400).json({
      success: false,
      message: 'Username must be between 3 and 20 characters.'
    });
  }

  if (!email.includes('@')) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid email address.'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters.'
    });
  }

  // ── Duplicate check ───────────────────────────────────────────────────────
  const existingUsername = db.prepare(
    'SELECT id FROM users WHERE username = ?'
  ).get(username.trim().toLowerCase());
  if (existingUsername) {
    return res.status(409).json({
      success: false,
      message: 'That username is already taken. Please choose another.'
    });
  }

  const existingEmail = db.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).get(email.trim().toLowerCase());
  if (existingEmail) {
    return res.status(409).json({
      success: false,
      message: 'An account with that email address already exists.'
    });
  }

  // ── Create the account ────────────────────────────────────────────────────
  const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);

  db.prepare(
    'INSERT INTO users (username, password, role, full_name, email) VALUES (?, ?, ?, ?, ?)'
  ).run(
    username.trim().toLowerCase(),
    hashedPassword,
    'student',          // Cannot self-elevate; always assigned 'student'
    full_name.trim(),
    email.trim().toLowerCase()
  );

  // Log the registration
  db.prepare(
    'INSERT INTO audit_log (username, action, target, ip_address) VALUES (?, ?, ?, ?)'
  ).run(username.trim().toLowerCase(), 'REGISTER', '', req.ip || '');

  return res.status(201).json({
    success: true,
    message: `Account created successfully! Welcome, ${full_name.trim()}.`
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
