/**
 * database.js  (backend/database.js)
 *
 * Handles SQLite database connection, table creation, and seed data.
 * Uses sql.js (a pure JavaScript / WebAssembly port of SQLite) so that no
 * native C++ compilation (node-gyp / Visual Studio) is required.
 *
 * Because sql.js loads its WASM binary asynchronously, the exported
 * initDatabase() function is async. server.js awaits it before starting
 * the HTTP server so every route can use the `db` object synchronously.
 *
 * Compatibility layer
 * ───────────────────
 * The `db` object exported here mimics the better-sqlite3 API so that all
 * route files can call db.prepare(...).get() / .all() / .run() without any
 * changes.  After every write the full database is flushed to disk so data
 * survives process restarts.
 */

const initSqlJs = require('sql.js');
const path      = require('path');
const fs        = require('fs');
const bcrypt    = require('bcryptjs');

// ── Paths ────────────────────────────────────────────────────────────────────

const dbDir  = path.join(__dirname, '..', 'database');
const dbPath = path.join(dbDir, 'campusconnect.db');

// Make sure the database/ directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// ── Internal sql.js database instance (set by initDatabase) ─────────────────

let _db = null;

// ── Helper: persist the in-memory database to disk ──────────────────────────

function saveDb() {
  const data = _db.export();              // Returns a Uint8Array
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// ── Compatibility Statement class ────────────────────────────────────────────
//
// Wraps a sql.js prepared statement with the better-sqlite3 API so route
// files don't need to know which library is being used underneath.
//
class Statement {
  constructor(sql) {
    this._sql = sql;
  }

  /**
   * get(...params)
   * Execute the query and return the FIRST row as a plain object, or
   * undefined if no rows matched.
   */
  get(...params) {
    const stmt      = _db.prepare(this._sql);
    const flatParams = params.flat();
    if (flatParams.length > 0) stmt.bind(flatParams);

    let row;
    if (stmt.step()) {
      row = stmt.getAsObject();     // { column: value, … }
    }
    stmt.free();
    return row;                     // undefined when no row found
  }

  /**
   * all(...params)
   * Execute the query and return ALL matching rows as an array of objects.
   */
  all(...params) {
    const stmt       = _db.prepare(this._sql);
    const flatParams = params.flat();
    if (flatParams.length > 0) stmt.bind(flatParams);

    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  /**
   * run(...params)
   * Execute a data-modifying statement (INSERT / UPDATE / DELETE).
   * Flushes the database to disk after every write.
   */
  run(...params) {
    const stmt       = _db.prepare(this._sql);
    const flatParams = params.flat();
    if (flatParams.length > 0) stmt.bind(flatParams);

    stmt.step();    // Execute one step (runs the DML statement)
    stmt.free();
    saveDb();       // Persist changes to disk immediately
  }
}

// ── Public `db` object – used by all route files ─────────────────────────────

const db = {
  /**
   * prepare(sql) → Statement
   * Returns a Statement object with .get() / .all() / .run() methods.
   */
  prepare(sql) {
    return new Statement(sql);
  },

  /**
   * exec(sql)
   * Run one or more DDL statements (e.g. CREATE TABLE).
   * Does NOT support bind parameters – use prepare().run() for DML.
   */
  exec(sql) {
    _db.exec(sql);    // sql.js exec() handles multiple ; separated statements
    saveDb();
  },

  /**
   * pragma()  – no-op shim (sql.js manages pragmas internally)
   */
  pragma() {}
};

// ── dangerousRawQuery (FOR SQL INJECTION DEMO ONLY) ──────────────────────────
//
// ⚠️  WARNING: This function executes a raw SQL string with NO parameterisation.
//     It exists solely to demonstrate why string-concatenated queries are
//     vulnerable to SQL injection attacks.
//
//     NEVER call this function with user input in production code.
//     NEVER use this function outside of the sqli-demo route.
//
function dangerousRawQuery(sql) {
  try {
    // sql.js exec() runs the raw SQL string as-is — attacker input included.
    const results = _db.exec(sql);
    if (!results || results.length === 0) return [];   // No rows matched
    const { columns, values } = results[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  } catch (err) {
    // Re-throw so the route can catch and display the SQL error to the student
    throw err;
  }
}

// ── initDatabase (async) ─────────────────────────────────────────────────────

async function initDatabase() {

  // Load the sql.js WASM binary (pure JS, no C++ required)
  const SQL = await initSqlJs();

  // Re-use the existing database file if it exists, otherwise create fresh
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    _db = new SQL.Database(fileBuffer);
    console.log('[DB] Loaded existing database → database/campusconnect.db');
  } else {
    _db = new SQL.Database();
    console.log('[DB] Created new database → database/campusconnect.db');
  }

  // ── Create tables ──────────────────────────────────────────────────────────

  // Users table – stores login credentials and roles
  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT    NOT NULL UNIQUE,
      password   TEXT    NOT NULL,
      role       TEXT    NOT NULL DEFAULT 'student',
      full_name  TEXT    NOT NULL,
      email      TEXT    NOT NULL,
      created_at TEXT    DEFAULT (datetime('now'))
    )
  `);

  // Students table – the directory of enrolled students
  _db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id  TEXT    NOT NULL UNIQUE,
      full_name   TEXT    NOT NULL,
      email       TEXT    NOT NULL,
      department  TEXT    NOT NULL,
      year        INTEGER NOT NULL,
      gpa         REAL    DEFAULT 0.0,
      phone       TEXT    DEFAULT '',
      address     TEXT    DEFAULT '',
      is_public   INTEGER DEFAULT 1,
      created_by  TEXT    DEFAULT 'admin',
      created_at  TEXT    DEFAULT (datetime('now'))
    )
  `);

  // Audit log – records every significant action for the diagnostics module
  _db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL,
      action     TEXT NOT NULL,
      target     TEXT DEFAULT '',
      ip_address TEXT DEFAULT '',
      timestamp  TEXT DEFAULT (datetime('now'))
    )
  `);

  // Announcements table – campus-wide notices and updates
  _db.exec(`
    CREATE TABLE IF NOT EXISTS announcements (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      description TEXT NOT NULL,
      category    TEXT NOT NULL DEFAULT 'General',
      icon        TEXT NOT NULL DEFAULT '📢',
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  // Comments table – student feedback on the portal
  _db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id   INTEGER NOT NULL REFERENCES users(id),
      username     TEXT    NOT NULL,
      comment_text TEXT    NOT NULL,
      created_at   TEXT    DEFAULT (datetime('now'))
    )
  `);

  // ── Seed sample users (only when the table is empty) ──────────────────────

  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (!userCount || userCount.count === 0) {

    const SALT_ROUNDS = 10;
    const ins = db.prepare(
      'INSERT INTO users (username, password, role, full_name, email) VALUES (?, ?, ?, ?, ?)'
    );
    // Passwords are stored as bcrypt hashes.
    ins.run('admin',   bcrypt.hashSync('admin123',   SALT_ROUNDS), 'admin',   'Admin User',        'admin@campusconnect.edu');
    ins.run('teacher', bcrypt.hashSync('teacher123', SALT_ROUNDS), 'teacher', 'Dr. Sarah Johnson', 'sjohnson@campusconnect.edu');
    ins.run('alice',   bcrypt.hashSync('alice123',   SALT_ROUNDS), 'student', 'Alice Smith',       'alice@campusconnect.edu');
    ins.run('bob',     bcrypt.hashSync('bob123',     SALT_ROUNDS), 'student', 'Bob Jones',         'bob@campusconnect.edu');
    ins.run('charlie', bcrypt.hashSync('charlie123', SALT_ROUNDS), 'student', 'Charlie Brown',     'charlie@campusconnect.edu');

    console.log('[DB] Seeded users table with 5 sample accounts (bcrypt hashed passwords).');
  }

  // ── Seed sample student records (only when the table is empty) ────────────

  const studentCount = db.prepare('SELECT COUNT(*) AS count FROM students').get();
  if (!studentCount || studentCount.count === 0) {

    const ins = db.prepare(`
      INSERT INTO students
        (student_id, full_name, email, department, year, gpa, phone, address, is_public, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    ins.run('CS2021001', 'Alice Smith',   'alice@campusconnect.edu',   'Computer Science', 3, 3.8, '555-0101', '123 Maple Street', 1, 'admin');
    ins.run('CS2021002', 'Bob Jones',     'bob@campusconnect.edu',     'Computer Science', 2, 3.2, '555-0102', '456 Oak Avenue',   1, 'admin');
    ins.run('CS2021003', 'Charlie Brown', 'charlie@campusconnect.edu', 'Computer Science', 4, 3.5, '555-0103', '789 Pine Road',    1, 'admin');
    ins.run('EE2021004', 'Diana Prince',  'diana@campusconnect.edu',   'Electrical Eng',   1, 3.9, '555-0104', '321 Elm Street',   1, 'admin');
    ins.run('ME2021005', 'Ethan Hunt',    'ethan@campusconnect.edu',   'Mechanical Eng',   3, 2.8, '555-0105', '654 Cedar Lane',   1, 'admin');
    ins.run('CS2021006', 'Fiona Green',   'fiona@campusconnect.edu',   'Computer Science', 2, 3.6, '555-0106', '987 Birch Blvd',   1, 'admin');
    ins.run('BU2021007', 'George Wilson', 'george@campusconnect.edu',  'Business Admin',   4, 3.1, '555-0107', '147 Walnut Way',   1, 'admin');
    ins.run('PS2021008', 'Hannah Brown',  'hannah@campusconnect.edu',  'Physics',          1, 3.7, '555-0108', '258 Spruce Court', 1, 'admin');

    console.log('[DB] Seeded students table with 8 sample records.');
  }

  // ── Seed sample announcements (only when the table is empty) ──────────────

  const annCount = db.prepare('SELECT COUNT(*) AS count FROM announcements').get();
  if (!annCount || annCount.count === 0) {

    const ins = db.prepare(
      'INSERT INTO announcements (title, description, category, icon) VALUES (?, ?, ?, ?)'
    );
    ins.run('Mid-Semester Exam Schedule Released',
      'The mid-semester examination timetable has been posted on the student portal. Please review your schedule and report any conflicts to the examination office by Friday.',
      'Academic', '📅');
    ins.run('Campus Maintenance: Library Closed This Weekend',
      'The main library building will be closed on Saturday and Sunday for routine HVAC maintenance. Digital resources remain available 24/7 through the library website.',
      'Facilities', '🏛️');
    ins.run('Scholarship Applications Now Open',
      'Applications for the Merit Scholarship 2025 are now open. Eligible students with a GPA of 3.5 or above may apply through the financial aid portal before December 15.',
      'Financial Aid', '🎓');
    ins.run('New Research Lab Inaugurated',
      'The Department of Computer Science proudly inaugurated its new Cybersecurity Research Lab today. The lab is equipped with cutting-edge hardware for penetration testing and secure systems research.',
      'Facilities', '🔬');
    ins.run('Inter-University Hackathon – Register Now',
      'Team CampusConnect is hosting the annual Inter-University Hackathon on December 10–11. Prizes worth ₹1,00,000 are up for grabs. Register before November 30.',
      'Events', '💻');

    console.log('[DB] Seeded announcements table with 5 sample records.');
  }

  // ── SQL Injection Demo table ──────────────────────────────────────────────
  //
  // ⚠️  DEMO ONLY: Passwords stored as PLAIN TEXT so the vulnerable SQL query
  //     can compare them directly in the WHERE clause.  This intentional design
  //     is part of the security demonstration — do NOT copy this pattern.
  //
  _db.exec(`
    CREATE TABLE IF NOT EXISTS sqli_demo_users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      username  TEXT NOT NULL UNIQUE,
      password  TEXT NOT NULL,          -- plain text, demo table only
      role      TEXT NOT NULL DEFAULT 'demo',
      full_name TEXT NOT NULL
    )
  `);

  const demoCount = db.prepare('SELECT COUNT(*) AS count FROM sqli_demo_users').get();
  if (!demoCount || demoCount.count === 0) {
    const ins = db.prepare(
      'INSERT INTO sqli_demo_users (username, password, role, full_name) VALUES (?, ?, ?, ?)'
    );
    // Seed three demo-only accounts with simple, known passwords
    ins.run('demouser',  'demopass',   'student', 'Demo Student');
    ins.run('demoadmin', 'adminpass',  'admin',   'Demo Admin');
    ins.run('alice_lab', 'labpass123', 'student', 'Alice (Lab Account)');
    console.log('[DB] Seeded sqli_demo_users table with 3 demo accounts.');
  }

  // Persist the initialised (and possibly seeded) database to disk
  saveDb();
  console.log('[DB] Database ready.');
}

module.exports = { db, dangerousRawQuery, initDatabase };
