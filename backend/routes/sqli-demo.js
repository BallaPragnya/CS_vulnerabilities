/**
 * sqli-demo.js  (backend/routes/sqli-demo.js)
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          SQL INJECTION DEMONSTRATION  –  SECURITY LAB           ║
 * ║                                                                  ║
 * ║  ⚠️  FOR EDUCATIONAL USE ONLY ON LOCALHOST                       ║
 * ║  Uses an ISOLATED dummy table (sqli_demo_users).                 ║
 * ║  NEVER connected to the real authentication system.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Routes:
 *   POST /api/sqli-demo/login    – runs a login attempt in either mode
 *   GET  /api/sqli-demo/accounts – lists the dummy demo accounts (no hashes)
 */

const express = require('express');
const router  = express.Router();
const { db, dangerousRawQuery } = require('../database');

// ── POST /api/sqli-demo/login ─────────────────────────────────────────────────
//
//  Body: { username: string, password: string, mode: 'vulnerable' | 'secure' }
//
//  Returns:
//    success         – whether the login attempt succeeded
//    constructedSql  – the actual SQL string sent to the DB (redacted in secure)
//    rowsReturned    – how many rows the query matched
//    explanation     – short note about why the result happened
//    mode            – echoes the mode back for the UI
//
router.post('/login', (req, res) => {
  const { username = '', password = '', mode } = req.body;

  if (!['vulnerable', 'secure'].includes(mode)) {
    return res.status(400).json({ success: false, message: 'mode must be "vulnerable" or "secure".' });
  }

  // ── Log the demo attempt for the audit trail ────────────────────────────────
  db.prepare(
    'INSERT INTO audit_log (username, action, target, ip_address) VALUES (?, ?, ?, ?)'
  ).run(
    `[DEMO:${mode}] ${username.substring(0, 40)}`,
    'SQLI_DEMO_ATTEMPT',
    'sqli_demo_users',
    req.ip || ''
  );

  // ════════════════════════════════════════════════════════════════════════════
  // MODE 1 – VULNERABLE
  // ════════════════════════════════════════════════════════════════════════════
  if (mode === 'vulnerable') {

    //
    // ⚠️  VULNERABILITY: User-supplied values are pasted directly into the
    //     SQL string using template-literal concatenation.
    //
    // Because the input is NOT sanitised or escaped, an attacker can break
    // out of the string literal with a single quote ( ' ) and append
    // arbitrary SQL logic, changing the WHERE clause entirely.
    //
    // Example malicious input:
    //   username = ' OR '1'='1' --
    //   password = (anything)
    //
    // The resulting query becomes:
    //   SELECT … WHERE username = '' OR '1'='1' --' AND password = '…'
    //   ─────────────────────────────────────────────
    //   The '-- ' comments out the password check.
    //   '1'='1' is always TRUE, so EVERY row is returned.
    //   First row is treated as the authenticated user → bypass!
    //

    // ► THE VULNERABLE LINE (string concatenation with raw user input):
    const sql = `SELECT id, username, role, full_name FROM sqli_demo_users`
              + ` WHERE username = '${username}'`     // ← raw input embedded here
              + ` AND password = '${password}'`;      // ← raw input embedded here

    let rows = [];
    let queryError = null;

    try {
      // Execute the raw (un-parameterised) SQL string
      rows = dangerousRawQuery(sql);
    } catch (err) {
      // SQL syntax errors from malformed injection attempts are caught here
      queryError = err.message;
    }

    const bypassed = rows.length > 0;

    return res.json({
      mode:           'vulnerable',
      success:        bypassed,
      rowsReturned:   rows.length,
      constructedSql: sql,       // ← Show the full query so students can see the injection
      loggedInAs:     bypassed ? { username: rows[0].username, role: rows[0].role, full_name: rows[0].full_name } : null,
      queryError:     queryError,
      explanation:    bypassed
        ? '⚠️ Authentication bypassed! The injected SQL changed the WHERE clause so it returned rows without matching valid credentials.'
        : queryError
          ? '💥 The injected payload caused a SQL syntax error — the query was malformed but still dangerous.'
          : '🔒 The login failed — the payload did not produce a successful injection this time.'
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MODE 2 – SECURE
  // ════════════════════════════════════════════════════════════════════════════
  if (mode === 'secure') {

    //
    // ✅  FIX: Parameterised query using ? placeholders.
    //
    // The sql.js library (and all proper database drivers) treat ? placeholders
    // as LITERAL VALUE slots.  The user-supplied string is passed as a separate
    // parameter and NEVER interpreted as SQL syntax.
    //
    // Even if the attacker types:   ' OR '1'='1' --
    // the driver searches for a row where:
    //   username  EQUALS the literal string  "' OR '1'='1' --"
    //   password  EQUALS whatever they typed
    //
    // No such row exists in the database → login fails → no bypass possible.
    //

    // ► THE SECURE LINE (parameterised, ? placeholders, no concatenation):
    const user = db.prepare(
      `SELECT id, username, role, full_name FROM sqli_demo_users
       WHERE username = ? AND password = ?`   // ← ? are safe value placeholders
    ).get(username, password);                // ← values bound separately, never interpreted as SQL

    return res.json({
      mode:           'secure',
      success:        !!user,
      rowsReturned:   user ? 1 : 0,
      // Show the template only – never reflect user input back into the SQL string
      constructedSql: `SELECT id, username, role, full_name FROM sqli_demo_users\nWHERE username = ? AND password = ?`,
      parameterValues: ['[username value]', '[password value]'],
      loggedInAs:     user ? { username: user.username, role: user.role, full_name: user.full_name } : null,
      explanation:    user
        ? '✅ Login successful. Parameterised queries verify credentials correctly when real credentials are supplied.'
        : '🛡️ Attack blocked! The injection string was treated as a plain text value and matched no account — parameterised queries cannot be injected.'
    });
  }
});

// ── GET /api/sqli-demo/accounts ───────────────────────────────────────────────
// Returns the demo account list so the UI can show "available accounts".
// Intentionally OMITS the password column.
router.get('/accounts', (req, res) => {
  const accounts = db.prepare(
    'SELECT id, username, role, full_name FROM sqli_demo_users ORDER BY id'
  ).all();
  return res.json({ success: true, accounts });
});

module.exports = router;
