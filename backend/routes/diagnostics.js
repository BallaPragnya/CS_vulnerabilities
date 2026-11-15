/**
 * diagnostics.js  (backend/routes/diagnostics.js)
 * 
 * Server diagnostics module routes.
 * Phase 1: Returns basic server health info.
 * Phase 2: Command injection and path traversal vulnerabilities will be added.
 * 
 * Routes:
 *   GET /api/diagnostics/status  – server status and uptime
 *   GET /api/diagnostics/logs    – recent audit log entries
 */

const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { requireLogin } = require('../middleware/authMiddleware');

// ── GET /api/diagnostics/status ─────────────────────────────────────────────
// Returns basic server health and uptime information.
router.get('/status', requireLogin, (req, res) => {
  return res.json({
    success: true,
    status: {
      server:    'CampusConnect v1.0',
      uptime:    `${Math.floor(process.uptime())} seconds`,
      node:      process.version,
      platform:  process.platform,
      memory:    `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB used`,
      timestamp: new Date().toISOString()
    }
  });
});

// ── GET /api/diagnostics/logs ────────────────────────────────────────────────
// Returns the 20 most recent audit log entries.
router.get('/logs', requireLogin, (req, res) => {
  const logs = db.prepare(
    'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 20'
  ).all();
  return res.json({ success: true, logs });
});

module.exports = router;
