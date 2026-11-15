/**
 * settings.js  (backend/routes/settings.js)
 *
 * Account Settings module.
 *
 * Routes:
 *   GET  /api/settings/profile         – get current user profile
 *   POST /api/settings/update-profile  – update display name
 *   POST /api/settings/change-password – change password (bcrypt)
 *
 * ── SECURITY LAB ROUTES (CSRF – Cross-Site Request Forgery) ──────────────
 *   GET  /api/settings/csrf-token      – generates and returns a CSRF token
 *   POST /api/settings/email-vuln      – VULNERABLE email update (no CSRF check)
 *   POST /api/settings/email-safe      – SECURE email update (validates CSRF token)
 */

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const { db }  = require('../database');
const { requireLogin } = require('../middleware/authMiddleware');

const SALT_ROUNDS = 10;

// ── GET /api/settings/profile ────────────────────────────────────────────────
router.get('/profile', requireLogin, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, role, full_name, email, created_at FROM users WHERE id = ?'
  ).get(req.session.user.id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const student = db.prepare(
    'SELECT student_id, department, year, gpa, phone, address FROM students WHERE email = ?'
  ).get(user.email);

  const profile = {
    ...user,
    enrollment: student ? student.student_id : null,
    department: student ? student.department  : null,
    year:       student ? student.year        : null,
    gpa:        student ? student.gpa         : null,
    phone:      student ? student.phone       : null,
    address:    student ? student.address     : null
  };

  return res.json({ success: true, profile });
});

// ── POST /api/settings/update-profile ───────────────────────────────────────
router.post('/update-profile', requireLogin, (req, res) => {
  const { full_name } = req.body;
  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ success: false, message: 'Full name is required.' });
  }
  db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(full_name.trim(), req.session.user.id);
  req.session.user.full_name = full_name.trim();
  return res.json({ success: true, message: 'Profile updated successfully.' });
});

// ── POST /api/settings/update-email ─────────────────────────────────────────
// Normal (safe) email update – used by the regular settings page
router.post('/update-email', requireLogin, (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Valid email required.' });
  }
  const existing = db.prepare(
    'SELECT id FROM users WHERE email = ? AND id != ?'
  ).get(email.trim().toLowerCase(), req.session.user.id);
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already in use.' });
  }
  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email.trim().toLowerCase(), req.session.user.id);
  req.session.user.email = email.trim().toLowerCase();
  return res.json({ success: true, message: 'Email updated successfully.' });
});

// ── POST /api/settings/change-password ──────────────────────────────────────
router.post('/change-password', requireLogin, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, message: 'Both passwords required.' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
  }
  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.session.user.id);
  if (!user || !bcrypt.compareSync(current_password, user.password)) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
  }
  const newHash = bcrypt.hashSync(new_password, SALT_ROUNDS);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newHash, req.session.user.id);
  db.prepare(
    'INSERT INTO audit_log (username, action, target, ip_address) VALUES (?, ?, ?, ?)'
  ).run(req.session.user.username, 'PASSWORD_CHANGE', '', req.ip || '');
  return res.json({ success: true, message: 'Password changed successfully.' });
});

// ════════════════════════════════════════════════════════════════════════════
// SECURITY LAB: CSRF – CROSS-SITE REQUEST FORGERY
// ════════════════════════════════════════════════════════════════════════════

// ── GET /api/settings/csrf-token ─────────────────────────────────────────────
//
// ✅  Generates a random, unpredictable CSRF token and stores it in the session.
//
// The synchronizer token pattern:
//   1. The server generates a random token and stores it in the user's session.
//   2. The server includes the token in the form HTML (as a hidden field).
//   3. When the form is submitted, the server compares the submitted token
//      to the one stored in the session.
//   4. If they don't match (or the token is missing), the request is rejected.
//
// An attacker's forged form (hosted on a different origin) cannot read the
// token from the victim's session because of the Same-Origin Policy.
// Therefore the forged request will not include a valid token → rejected.
//
router.get('/csrf-token', requireLogin, (req, res) => {
  // Generate a secure random 32-byte hex token
  const token = crypto.randomBytes(32).toString('hex');

  // Store it in the session so we can validate it later
  req.session.csrfToken = token;

  return res.json({ success: true, csrfToken: token });
});

// ── POST /api/settings/email-vuln ────────────────────────────────────────────
//
// ⚠️  VULNERABLE MODE: No CSRF token check at all.
//
// This endpoint accepts a POST request to change the user's email address
// WITHOUT verifying that the request originated from our trusted form.
//
// Because the user is logged in (session cookie is sent automatically with
// every request including cross-origin ones), a malicious page can forge
// this request simply by submitting a form to this URL.
//
// The attacker's page just needs to auto-submit a hidden form like:
//   <form action="http://localhost:3000/api/settings/email-vuln" method="POST">
//     <input name="email" value="hacker@evil.com" />
//   </form>
//   <script>document.forms[0].submit();</script>
//
// The browser sends the session cookie automatically → email is changed!
//
router.post('/email-vuln', requireLogin, (req, res) => {
  const { email } = req.body;

  // ► VULNERABILITY: No CSRF token check here — any forged request is accepted!

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Valid email required.' });
  }

  // Update the email – no questions asked about request origin
  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email.trim().toLowerCase(), req.session.user.id);
  req.session.user.email = email.trim().toLowerCase();

  db.prepare(
    'INSERT INTO audit_log (username, action, target, ip_address) VALUES (?, ?, ?, ?)'
  ).run(req.session.user.username, 'CSRF_DEMO_VULN_EMAIL_CHANGE', email.substring(0, 60), req.ip || '');

  return res.json({
    success:     true,
    mode:        'vulnerable',
    message:     `✅ Email changed to "${email.trim().toLowerCase()}". (No CSRF token was checked!)`,
    newEmail:    email.trim().toLowerCase(),
    explanation: '⚠️ This endpoint accepted the request without any CSRF validation. A forged cross-origin form submission would have the same result.'
  });
});

// ── POST /api/settings/email-safe ────────────────────────────────────────────
//
// ✅  SECURE MODE: Validates the CSRF token before processing.
//
// The request must include an X-CSRF-Token header (or csrf_token body field)
// that matches the token stored in the user's session.
//
// A forged request from an attacker's page cannot include this token because:
//   - The token is only readable from within our application (same-origin).
//   - The attacker cannot read our HTML or our API responses cross-origin.
//   - Even if the attacker guesses the endpoint, they cannot guess the token
//     (crypto.randomBytes(32) → 2^256 possible values).
//
router.post('/email-safe', requireLogin, (req, res) => {
  const { email, csrf_token } = req.body;

  // ► MITIGATION: Check that the submitted CSRF token matches the session token
  const sessionToken = req.session.csrfToken;

  if (!csrf_token || !sessionToken || csrf_token !== sessionToken) {
    // Token missing, empty, or does not match → reject the request
    db.prepare(
      'INSERT INTO audit_log (username, action, target, ip_address) VALUES (?, ?, ?, ?)'
    ).run(req.session.user.username, 'CSRF_DEMO_SAFE_BLOCKED', email || '', req.ip || '');

    return res.status(403).json({
      success:     false,
      mode:        'secure',
      message:     '🛡️ CSRF token mismatch! Request rejected.',
      explanation: 'The submitted CSRF token did not match the token stored in your session. This is exactly what blocks a forged cross-site request — the attacker cannot know your session token.'
    });
  }

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Valid email required.' });
  }

  // Token is valid → process the request
  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email.trim().toLowerCase(), req.session.user.id);
  req.session.user.email = email.trim().toLowerCase();

  // Rotate the CSRF token after each successful use (token rotation)
  req.session.csrfToken = crypto.randomBytes(32).toString('hex');

  db.prepare(
    'INSERT INTO audit_log (username, action, target, ip_address) VALUES (?, ?, ?, ?)'
  ).run(req.session.user.username, 'CSRF_DEMO_SAFE_EMAIL_CHANGE', email.substring(0, 60), req.ip || '');

  return res.json({
    success:     true,
    mode:        'secure',
    message:     `✅ Email changed to "${email.trim().toLowerCase()}". CSRF token was validated.`,
    newEmail:    email.trim().toLowerCase(),
    explanation: '✅ The CSRF token matched the session token. This request was accepted because it came from our trusted form. A forged request would not have a valid token and would be rejected.'
  });
});

module.exports = router;
