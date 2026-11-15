/**
 * server.js  (backend/server.js)
 * 
 * Main entry point for the CampusConnect backend.
 * 
 * Responsibilities:
 *   - Create the Express application
 *   - Configure middleware (session, JSON parsing, CORS, static files)
 *   - Mount all API route modules
 *   - Start the HTTP server on port 3000
 */

const express    = require('express');
const session    = require('express-session');
const cors       = require('cors');
const path       = require('path');

// Import our database initialiser
const { initDatabase } = require('./database');

// Import all route modules
const authRoutes          = require('./routes/auth');
const directoryRoutes     = require('./routes/directory');
const diagnosticsRoutes   = require('./routes/diagnostics');
const searchRoutes        = require('./routes/search');
const settingsRoutes      = require('./routes/settings');
const announcementsRoutes = require('./routes/announcements');
const commentsRoutes      = require('./routes/comments');
// ⚠️  SECURITY LAB ONLY – intentionally vulnerable demo route (localhost only)
const sqliDemoRoutes      = require('./routes/sqli-demo');

// ── Create the Express app ───────────────────────────────────────────────────
const app  = express();
const PORT = 3000;

// ── Middleware setup ─────────────────────────────────────────────────────────

// Allow JSON request bodies (for POST requests from the frontend)
app.use(express.json());

// Allow URL-encoded form bodies (fallback for traditional HTML forms)
app.use(express.urlencoded({ extended: true }));

// CORS – allow requests from the same origin (localhost during development)
app.use(cors({
  origin: `http://localhost:${PORT}`,
  credentials: true  // required for session cookies
}));

// Session management using express-session
// The secret key signs the session cookie to prevent tampering.
app.use(session({
  name:   'campusconnect.sid',         // Cookie name in the browser
  secret: 'campusconnect-secret-2024', // Secret used to sign the cookie
  resave:            false,            // Don't save session if unmodified
  saveUninitialized: false,            // Don't create session until data is stored
  cookie: {
    httpOnly: true,   // Prevents JavaScript from reading the cookie
    maxAge:   1000 * 60 * 60 * 2  // Session expires after 2 hours (in milliseconds)
  }
}));

// ── Static file serving ──────────────────────────────────────────────────────
// Serves all files inside the frontend/ folder directly (HTML, CSS, JS, images)
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// ── API Routes ───────────────────────────────────────────────────────────────
// All API endpoints are prefixed with /api/ to separate them from static files
app.use('/api/auth',          authRoutes);
app.use('/api/directory',     directoryRoutes);
app.use('/api/diagnostics',   diagnosticsRoutes);
app.use('/api/search',        searchRoutes);
app.use('/api/settings',      settingsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/comments',      commentsRoutes);
// ⚠️  SECURITY LAB: SQL injection demo – for educational demonstration on localhost only
app.use('/api/sqli-demo',     sqliDemoRoutes);

// ── Catch-all route ──────────────────────────────────────────────────────────
// For any URL that doesn't match a file or API route, serve the homepage.
// This handles direct navigation to pages like /dashboard without a .html extension.
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ── Global error handler ─────────────────────────────────────────────────────
// Catches any unhandled errors and returns a clean JSON response.
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(500).json({
    success: false,
    message: 'An internal server error occurred. Please try again.'
  });
});

// ── Start the server (async so we can await database initialisation) ─────────
(async () => {
  try {
    // Wait for sql.js WASM to load and database tables to be created/seeded
    await initDatabase();

    app.listen(PORT, () => {
      console.log('');
      console.log('  ╔═══════════════════════════════════════════╗');
      console.log('  ║         CampusConnect is running!         ║');
      console.log(`  ║   Open: http://localhost:${PORT}             ║`);
      console.log('  ╚═══════════════════════════════════════════╝');
      console.log('');
      console.log('  Login credentials:');
      console.log('    admin    / admin123');
      console.log('    teacher  / teacher123');
      console.log('    alice    / alice123');
      console.log('');
    });
  } catch (err) {
    console.error('[FATAL] Could not initialise the database:', err);
    process.exit(1);
  }
})();
