/**
 * common.js  (frontend/js/common.js)
 * 
 * Shared utilities used by every page:
 *   - buildSidebar()     : injects the navigation sidebar HTML
 *   - checkAuth()        : redirects to login if user is not logged in
 *   - getUser()          : returns cached session user object
 *   - apiFetch()         : wrapper around fetch() with JSON defaults
 *   - logout()           : calls logout API and redirects
 *   - showAlert()        : shows a styled alert message in a container element
 *   - formatDate()       : converts ISO date string to readable format
 *   - setActiveNav()     : highlights the current page link in the sidebar
 */

// ── API helper ───────────────────────────────────────────────────────────────

/**
 * apiFetch(url, options)
 * A wrapper around the native fetch() API that:
 *   - Automatically sets Content-Type: application/json
 *   - Includes cookies (credentials: 'include') for session auth
 *   - Returns parsed JSON
 * 
 * @param {string} url     - API endpoint (e.g. '/api/auth/me')
 * @param {object} options - Standard fetch options (method, body, etc.)
 * @returns {Promise<object>} - Parsed JSON response
 */
async function apiFetch(url, options = {}) {
  const defaults = {
    credentials: 'include',                // Send cookies with every request
    headers: { 'Content-Type': 'application/json' }
  };

  // Merge default headers with any extra options provided
  const config = {
    ...defaults,
    ...options,
    headers: { ...defaults.headers, ...(options.headers || {}) }
  };

  const response = await fetch(url, config);
  const data = await response.json();

  // Attach the HTTP status to the data object so callers can check it
  data._status = response.status;
  return data;
}

// ── Session management ───────────────────────────────────────────────────────

// Cache the user object so we only call /api/auth/me once per page load
let _currentUser = null;

/**
 * getUser()
 * Returns the currently logged-in user from cache or API.
 * @returns {Promise<object|null>} User object or null if not authenticated
 */
async function getUser() {
  if (_currentUser) return _currentUser;

  try {
    const data = await apiFetch('/api/auth/me');
    if (data.success) {
      _currentUser = data.user;
      return _currentUser;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * checkAuth()
 * Ensures the user is logged in. If not, redirects to login.html.
 * Call this at the top of every protected page's JS file.
 * @returns {Promise<object>} The logged-in user object
 */
async function checkAuth() {
  const user = await getUser();
  if (!user) {
    window.location.href = '/login.html';
    return null;
  }
  return user;
}

/**
 * logout()
 * Calls the logout API endpoint and redirects to the login page.
 */
async function logout() {
  await apiFetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

// ── Sidebar builder ──────────────────────────────────────────────────────────

/**
 * buildSidebar(user)
 * Injects the sidebar HTML into the element with id="sidebar".
 * Highlights the active nav link based on the current URL.
 * 
 * @param {object} user - The logged-in user object from getUser()
 */
function buildSidebar(user) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  // Get the first letter of the user's name for the avatar
  const initials = user.full_name ? user.full_name.charAt(0).toUpperCase() : '?';

  // Role badge colour
  const roleBadge = {
    admin:   'badge-danger',
    teacher: 'badge-warning',
    student: 'badge-primary'
  }[user.role] || 'badge-muted';

  sidebar.innerHTML = `
    <!-- Logo / branding -->
    <div class="sidebar-logo">
      <div class="logo-icon">🎓</div>
      <div>
        <div class="logo-text">CampusConnect</div>
        <div class="logo-sub">Student Portal</div>
      </div>
    </div>

    <!-- Navigation links -->
    <nav class="sidebar-nav">
      <div class="nav-section-label">Main</div>

      <a href="/index.html" class="nav-link" id="nav-home">
        <span class="nav-icon">🏠</span> Home
      </a>
      <a href="/dashboard.html" class="nav-link" id="nav-dashboard">
        <span class="nav-icon">📊</span> Dashboard
      </a>

      <div class="nav-section-label">Modules</div>

      <a href="/directory.html" class="nav-link" id="nav-directory">
        <span class="nav-icon">📋</span> Directory
      </a>
      <a href="/search.html" class="nav-link" id="nav-search">
        <span class="nav-icon">🔍</span> Search
      </a>
      <a href="/diagnostics.html" class="nav-link" id="nav-diagnostics">
        <span class="nav-icon">🖥️</span> Diagnostics
      </a>
      <a href="/settings.html" class="nav-link" id="nav-settings">
        <span class="nav-icon">⚙️</span> Settings
      </a>
    </nav>

    <!-- User info + logout button at bottom -->
    <div class="sidebar-user">
      <div class="avatar">${initials}</div>
      <div class="user-info">
        <div class="user-name">${user.full_name}</div>
        <div class="user-role">
          <span class="badge ${roleBadge}">${user.role}</span>
        </div>
      </div>
      <button class="logout-btn" onclick="logout()" title="Logout">⏻</button>
    </div>
  `;

  // Highlight the active nav link
  setActiveNav();
}

/**
 * setActiveNav()
 * Adds the 'active' class to the nav link matching the current page.
 */
function setActiveNav() {
  const path = window.location.pathname;
  const map = {
    '/index.html':       'nav-home',
    '/':                 'nav-home',
    '/dashboard.html':   'nav-dashboard',
    '/directory.html':   'nav-directory',
    '/search.html':      'nav-search',
    '/diagnostics.html': 'nav-diagnostics',
    '/settings.html':    'nav-settings'
  };

  const activeId = map[path];
  if (activeId) {
    const el = document.getElementById(activeId);
    if (el) el.classList.add('active');
  }
}

// ── UI utilities ─────────────────────────────────────────────────────────────

/**
 * showAlert(containerId, message, type)
 * Displays a styled alert message inside the specified container element.
 * 
 * @param {string} containerId - ID of the container div
 * @param {string} message     - The message text to display
 * @param {string} type        - 'success' | 'error' | 'warning' | 'info'
 */
function showAlert(containerId, message, type = 'info') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const icons = {
    success: '✅',
    error:   '❌',
    warning: '⚠️',
    info:    'ℹ️'
  };

  container.className = `alert alert-${type} fade-in`;
  container.innerHTML = `<span>${icons[type] || ''}</span> <span>${message}</span>`;

  // Auto-clear success messages after 4 seconds
  if (type === 'success') {
    setTimeout(() => { container.innerHTML = ''; container.className = 'alert'; }, 4000);
  }
}

/**
 * formatDate(isoString)
 * Converts a SQLite datetime string to a readable local date.
 * @param {string} isoString - Date string like "2024-03-15 10:30:00"
 * @returns {string} Formatted date like "Mar 15, 2024"
 */
function formatDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString.replace(' ', 'T') + 'Z');
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * getRoleBadge(role)
 * Returns the HTML for a styled role badge.
 */
function getRoleBadge(role) {
  const classes = { admin: 'badge-danger', teacher: 'badge-warning', student: 'badge-primary' };
  return `<span class="badge ${classes[role] || 'badge-muted'}">${role}</span>`;
}
