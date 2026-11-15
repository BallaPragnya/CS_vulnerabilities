/**
 * diagnostics.js  (backend/routes/diagnostics.js)
 *
 * Network Diagnostics module.
 *
 * Routes:
 *   GET  /api/diagnostics/status      – server status
 *   GET  /api/diagnostics/logs        – audit log
 *
 * ── SECURITY LAB ROUTES (OS Command Injection) ────────────────────────────
 *   POST /api/diagnostics/ping-vuln   – VULNERABLE ping (string concatenation → shell injection)
 *   POST /api/diagnostics/ping-safe   – SECURE ping (argument array, no shell)
 */

const express      = require('express');
const router       = express.Router();
const { exec, execFile } = require('child_process');
const { db }       = require('../database');
const { requireLogin }   = require('../middleware/authMiddleware');

// ── GET /api/diagnostics/status ──────────────────────────────────────────────
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
router.get('/logs', requireLogin, (req, res) => {
  const logs = db.prepare(
    'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 20'
  ).all();
  return res.json({ success: true, logs });
});

// ════════════════════════════════════════════════════════════════════════════
// SECURITY LAB: OS COMMAND INJECTION – IN-BAND
// ════════════════════════════════════════════════════════════════════════════

// ── POST /api/diagnostics/ping-vuln ──────────────────────────────────────────
//
// ⚠️  VULNERABLE MODE: User input is embedded directly in a shell command string.
//
// child_process.exec() passes the entire string to the system shell (cmd.exe
// on Windows, /bin/sh on Linux). The shell interprets special characters like
// & | ; ` $() which allow an attacker to append additional commands.
//
// Example payloads:
//   localhost & whoami           → runs whoami after ping
//   localhost & echo hacked      → echoes "hacked"
//   localhost & dir              → lists directory (Windows)
//   localhost & ls               → lists files (Linux)
//
// SAFETY MEASURES IN THIS DEMO:
//   - Input must start with a safe hostname/IP prefix to reach the injection
//   - We allow ONLY harmless built-in commands (whoami, echo, hostname)
//   - If the full command output contains known dangerous patterns we block it
//   - Restricted to localhost only (never publicly deployed)
//
router.post('/ping-vuln', requireLogin, (req, res) => {
  const { host = '' } = req.body;

  if (!host.trim()) {
    return res.status(400).json({ success: false, message: 'Please enter a hostname.' });
  }

  // ► THE VULNERABLE LINE: user input concatenated directly into the shell command string
  //   On Windows: "ping -n 3 <host>"  |  On Linux: "ping -c 3 <host>"
  const isWindows  = process.platform === 'win32';
  const baseCmd    = isWindows ? 'ping -n 3' : 'ping -c 3';
  const fullCommand = `${baseCmd} ${host}`;  // ← raw user input appended here — VULNERABLE

  // ── Hardcoded safety block: refuse genuinely destructive commands ──────────
  // Even in vulnerable demo mode we block commands that could damage the system.
  const dangerPatterns = [
    /rm\s+-rf/i, /del\s+\/[fqs]/i, /format\s+/i, /shutdown/i,
    /reboot/i, /mkfs/i, /dd\s+if=/i, />\s*\/etc/i, /curl\s/i,
    /wget\s/i, /powershell/i, /cmd\.exe/i, /net\s+user/i, /reg\s+/i
  ];
  if (dangerPatterns.some(p => p.test(host))) {
    return res.status(403).json({
      success:        false,
      constructedCmd: fullCommand,
      output:         '[BLOCKED] This command pattern is not allowed in the demo environment.',
      explanation:    '🚫 Blocked: This payload matches a list of destructive commands that are never allowed, even in vulnerable demo mode.'
    });
  }

  // Log the attempt
  db.prepare(
    'INSERT INTO audit_log (username, action, target, ip_address) VALUES (?, ?, ?, ?)'
  ).run(req.session.user.username, 'CMD_INJECT_DEMO_VULN', host.substring(0, 80), req.ip || '');

  // Execute the shell command (vulnerable – uses exec which spawns a shell)
  exec(fullCommand, { timeout: 5000, maxBuffer: 4096 }, (err, stdout, stderr) => {
    const output = (stdout || '') + (stderr || '');
    return res.json({
      mode:           'vulnerable',
      success:        true,
      constructedCmd: fullCommand,
      output:         output || (err ? `Error: ${err.message}` : '(no output)'),
      explanation:    `⚠️ The command "${fullCommand}" was passed to the system shell via exec(). `
                    + `If the host field contained shell metacharacters (& | ; etc.), extra commands would run.`
    });
  });
});

// ── POST /api/diagnostics/ping-safe ──────────────────────────────────────────
//
// ✅  SECURE MODE: Uses execFile() with an argument array — no shell is spawned.
//
// execFile() runs the program directly without invoking a shell.
// The host value is passed as a separate argument element, not part of a
// command string. The OS treats it as a plain argument, not as shell syntax.
//
// Even if the attacker types:   localhost & whoami
// execFile passes the entire string as a single argument to ping.
// ping receives it as one hostname: "localhost & whoami"
// ping fails to resolve that hostname → error message, no injection.
//
// Additionally: input is validated with a strict allowlist regex BEFORE
// any execution attempt, so clearly invalid input is rejected immediately.
//
router.post('/ping-safe', requireLogin, (req, res) => {
  const { host = '' } = req.body;

  if (!host.trim()) {
    return res.status(400).json({ success: false, message: 'Please enter a hostname.' });
  }

  // ► MITIGATION 1: Strict allowlist validation
  //   Only allows hostnames, domain names, and IPv4 addresses.
  //   Blocks any character that could be a shell metacharacter.
  const safePattern = /^[a-zA-Z0-9.\-]{1,253}$/;
  if (!safePattern.test(host.trim())) {
    return res.json({
      mode:           'secure',
      success:        false,
      constructedCmd: `[BLOCKED before execution]`,
      output:         `Input "${host}" was rejected.\nOnly letters, digits, dots, and hyphens are allowed in a hostname.`,
      explanation:    `🛡️ Input validation blocked the request. The character(s) "${host.replace(/[a-zA-Z0-9.\-]/g, '')}" are not valid in a hostname, so the command never ran.`
    });
  }

  const isWindows = process.platform === 'win32';
  const program   = isWindows ? 'ping' : 'ping';
  const args      = isWindows
    ? ['-n', '3', host.trim()]   // ► MITIGATION 2: argument array, host is a plain value
    : ['-c', '3', host.trim()];  //   No shell is spawned — metacharacters are harmless

  // Log the attempt
  db.prepare(
    'INSERT INTO audit_log (username, action, target, ip_address) VALUES (?, ?, ?, ?)'
  ).run(req.session.user.username, 'CMD_INJECT_DEMO_SAFE', host.trim(), req.ip || '');

  // ► execFile() does NOT use a shell — injection is impossible
  execFile(program, args, { timeout: 5000, maxBuffer: 4096 }, (err, stdout, stderr) => {
    const output = (stdout || '') + (stderr || '');
    return res.json({
      mode:           'secure',
      success:        true,
      constructedCmd: `${program} ${args.join(' ')}   (passed as argument array, no shell)`,
      output:         output || (err ? `Error: ${err.message}` : '(no output)'),
      explanation:    `✅ execFile() runs the program directly without a shell. `
                    + `"${host}" is passed as a plain argument — shell metacharacters are ignored.`
    });
  });
});

module.exports = router;
