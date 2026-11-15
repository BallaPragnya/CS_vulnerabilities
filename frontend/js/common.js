/**
 * common.js  –  Shared utilities for every protected page
 *
 * Functions exported to global scope (loaded before page-specific scripts):
 *   checkAuth()         → redirects to login.html if not logged in
 *   getUser()           → returns cached session user (from API or mock)
 *   buildSidebar(user)  → renders sidebar HTML + marks active nav link
 *   logout()            → calls logout API and redirects
 *   apiFetch(url, opts) → fetch wrapper with credentials + JSON defaults
 *   showAlert(id, msg, type) → shows styled alert in a container
 *   formatDate(str)     → formats ISO date string to "Nov 15, 2026"
 *   MOCK_DATA           → shared dummy data used by multiple pages
 */

/* ── Shared mock data ───────────────────────────────────────────────────────
   Used by dashboard, search and other pages so data is consistent.        */
const MOCK_DATA = {

  /* The "logged-in" student profile shown on dashboard / settings */
  profile: {
    name:        'Alice Smith',
    enrollment:  'CS2021001',
    email:       'alice@campusconnect.edu',
    department:  'Computer Science',
    year:        'Year 3',
    gpa:         '3.80',
    phone:       '555-0101',
    avatar:      'A'
  },

  /* Announcements shown on dashboard and campus search */
  announcements: [
    {
      id: 1,
      title: 'Mid-Semester Exam Schedule Released',
      body:  'The mid-semester examination timetable for November 2026 has been published on the portal.',
      date:  '2026-11-14',
      category: 'Academic',
      icon: '📋'
    },
    {
      id: 2,
      title: 'Library Extended Hours – Exam Week',
      body:  'The main library will remain open 24/7 during exam week (Nov 18 – Nov 25).',
      date:  '2026-11-13',
      category: 'Facilities',
      icon: '📚'
    },
    {
      id: 3,
      title: 'Scholarship Applications Now Open',
      body:  'Merit-based scholarships for the Spring 2027 semester are open. Apply before December 1.',
      date:  '2026-11-12',
      category: 'Finance',
      icon: '🎓'
    },
    {
      id: 4,
      title: 'Campus Wi-Fi Maintenance – Nov 17',
      body:  'Scheduled maintenance on the campus network from 2 AM to 5 AM on November 17.',
      date:  '2026-11-11',
      category: 'IT',
      icon: '📡'
    }
  ],

  /* Upcoming events shown on dashboard and campus search */
  events: [
    {
      id: 1,
      title: 'Tech Fest 2026 – Annual Tech Fair',
      date:  'November 20, 2026',
      time:  '10:00 AM – 5:00 PM',
      venue: 'Main Campus Auditorium',
      icon:  '💻'
    },
    {
      id: 2,
      title: 'Guest Lecture: AI in Healthcare',
      date:  'November 22, 2026',
      time:  '2:00 PM – 4:00 PM',
      venue: 'Seminar Hall B, Block 3',
      icon:  '🤖'
    },
    {
      id: 3,
      title: 'Annual Sports Day',
      date:  'November 28, 2026',
      time:  '8:00 AM – 6:00 PM',
      venue: 'University Sports Ground',
      icon:  '🏆'
    }
  ],

  /* Student directory – same 8 students seeded in the DB */
  students: [
    { id: 'CS2021001', name: 'Alice Smith',   dept: 'Computer Science', year: 3, gpa: 3.8, email: 'alice@campusconnect.edu',   color: '#2563eb' },
    { id: 'CS2021002', name: 'Bob Jones',     dept: 'Computer Science', year: 2, gpa: 3.2, email: 'bob@campusconnect.edu',     color: '#16a34a' },
    { id: 'CS2021003', name: 'Charlie Brown', dept: 'Computer Science', year: 4, gpa: 3.5, email: 'charlie@campusconnect.edu', color: '#d97706' },
    { id: 'EE2021004', name: 'Diana Prince',  dept: 'Electrical Eng',   year: 1, gpa: 3.9, email: 'diana@campusconnect.edu',   color: '#7c3aed' },
    { id: 'ME2021005', name: 'Ethan Hunt',    dept: 'Mechanical Eng',   year: 3, gpa: 2.8, email: 'ethan@campusconnect.edu',   color: '#db2777' },
    { id: 'CS2021006', name: 'Fiona Green',   dept: 'Computer Science', year: 2, gpa: 3.6, email: 'fiona@campusconnect.edu',   color: '#0891b2' },
    { id: 'BU2021007', name: 'George Wilson', dept: 'Business Admin',   year: 4, gpa: 3.1, email: 'george@campusconnect.edu',  color: '#be123c' },
    { id: 'PS2021008', name: 'Hannah Brown',  dept: 'Physics',          year: 1, gpa: 3.7, email: 'hannah@campusconnect.edu',  color: '#065f46' }
  ]
};

/* ── API fetch wrapper ──────────────────────────────────────────────────────*/
/**
 * apiFetch(url, options)
 * Wraps fetch() with JSON defaults and session credentials.
 * @returns {Promise<object>} Parsed JSON with ._status added
 */
async function apiFetch(url, options = {}) {
  const config = {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
    ...(options.headers ? { headers: { 'Content-Type': 'application/json', ...options.headers } } : {})
  };
  const res  = await fetch(url, config);
  const data = await res.json();
  data._status = res.status;
  return data;
}

/* ── Session cache ──────────────────────────────────────────────────────────*/
let _currentUser = null;

/**
 * getUser()
 * Returns the logged-in user from session API, or null if not authenticated.
 */
async function getUser() {
  if (_currentUser) return _currentUser;
  // ── Try the real session API ──
  try {
    const data = await apiFetch('/api/auth/me');
    if (data.success) { _currentUser = data.user; return data.user; }
  } catch { /* backend offline */ }
  // ── Fall back to mock session stored by login.html ──
  const raw = sessionStorage.getItem('mock_user');
  if (raw) {
    try {
      const u = JSON.parse(raw);
      _currentUser = { username: u.username, full_name: u.full_name, role: u.role };
      return _currentUser;
    } catch { /* corrupt storage */ }
  }
  return null;
}

/**
 * checkAuth()
 * Guards a protected page. Redirects to login if no active session.
 * @returns {Promise<object>} Logged-in user object
 */
async function checkAuth() {
  const user = await getUser();
  if (!user) { window.location.href = '/login.html'; return null; }
  return user;
}

/**
 * logout()
 * Calls the logout API and redirects to login page.
 */
async function logout() {
  try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch {}
  // Clear mock session as well
  sessionStorage.removeItem('mock_user');
  window.location.href = '/login.html';
}

/* ── Sidebar ────────────────────────────────────────────────────────────────*/
/**
 * buildSidebar(user)
 * Injects sidebar HTML into #sidebar and highlights the active nav link.
 */
function buildSidebar(user) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const initials = (user.full_name || user.username || '?').charAt(0).toUpperCase();

  sidebar.innerHTML = `
    <!-- Brand logo -->
    <div class="sidebar-logo">
      <div class="logo-icon">🎓</div>
      <div>
        <div class="logo-text">CampusConnect</div>
        <div class="logo-sub">Student Portal</div>
      </div>
    </div>

    <!-- Navigation links -->
    <nav class="sidebar-nav">
      <div class="nav-label">Main</div>
      <a href="/index.html"     class="nav-link" id="nav-home">
        <span class="nav-icon">🏠</span> Home
      </a>
      <a href="/dashboard.html" class="nav-link" id="nav-dashboard">
        <span class="nav-icon">📊</span> Dashboard
      </a>

      <div class="nav-label">Modules</div>
      <a href="/directory.html"   class="nav-link" id="nav-directory">
        <span class="nav-icon">👥</span> Student Directory
      </a>
      <a href="/search.html"      class="nav-link" id="nav-search">
        <span class="nav-icon">🔍</span> Campus Search
      </a>
      <a href="/diagnostics.html" class="nav-link" id="nav-diagnostics">
        <span class="nav-icon">🌐</span> Network Diagnostics
      </a>
      <a href="/settings.html"    class="nav-link" id="nav-settings">
        <span class="nav-icon">⚙️</span> Account Settings
      </a>

      <div class="nav-label" style="color:var(--danger); margin-top:0.5rem;">🔒 Security Lab</div>
      <a href="/login.html" class="nav-link nav-link-danger" id="nav-login">
        <span class="nav-icon">💉</span> 1. SQLi Auth Bypass
      </a>
      <a href="/directory.html" class="nav-link nav-link-danger" id="nav-directory">
        <span class="nav-icon">🔗</span> 2. SQLi UNION Attack
      </a>
      <a href="/diagnostics.html" class="nav-link nav-link-danger" id="nav-diagnostics">
        <span class="nav-icon">⚡</span> 3. Command Injection
      </a>
      <a href="/search.html" class="nav-link nav-link-danger" id="nav-search">
        <span class="nav-icon">📝</span> 4. Reflected XSS
      </a>
      <a href="/settings.html" class="nav-link nav-link-danger" id="nav-settings">
        <span class="nav-icon">🏴‍☠️</span> 5. CSRF
      </a>
      <a href="/csrf-attacker.html" target="_blank" class="nav-link nav-link-danger" id="nav-csrf-attack">
        <span class="nav-icon">🌐</span> CSRF Attacker Page ↗
      </a>
    </nav>

    <!-- Logged-in user at the bottom -->
    <div class="sidebar-user">
      <div class="avatar">${initials}</div>
      <div class="u-info">
        <div class="u-name">${user.full_name || user.username}</div>
        <div class="u-role">${user.role}</div>
      </div>
      <button class="u-logout" onclick="logout()" title="Logout">⏻</button>
    </div>
  `;

  /* Mark the current page as active */
  _setActiveNav();
}

/**
 * _setActiveNav()
 * Adds the .active class to the nav link matching the current URL.
 */
function _setActiveNav() {
  const path = window.location.pathname;
  const map = {
    '/':                 'nav-home',
    '/index.html':       'nav-home',
    '/dashboard.html':   'nav-dashboard',
    '/login.html':       'nav-login',
    '/directory.html':   'nav-directory',
    '/search.html':      'nav-search',
    '/diagnostics.html': 'nav-diagnostics',
    '/settings.html':    'nav-settings',
    '/csrf-attacker.html': 'nav-csrf-attack'
  };
  const id = map[path];
  if (id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }
}

/* ── UI helpers ─────────────────────────────────────────────────────────────*/

/**
 * showAlert(containerId, message, type)
 * Renders a styled alert message inside a container element.
 * @param {string} containerId – id of the div that will hold the alert
 * @param {string} message     – the text to display
 * @param {string} type        – 'success' | 'error' | 'warning' | 'info'
 */
function showAlert(containerId, message, type = 'info') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  el.className = `alert alert-${type} fade-up`;
  el.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  if (type === 'success') setTimeout(() => { el.innerHTML = ''; el.className = 'alert'; }, 4000);
}

/**
 * formatDate(isoStr)
 * Converts a date string to a human-readable format.
 * @returns {string} e.g. "Nov 15, 2026"
 */
function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr.replace(' ', 'T'));
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * sleep(ms)
 * Returns a promise that resolves after `ms` milliseconds.
 * Used to simulate network delays in mock functions.
 */
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
