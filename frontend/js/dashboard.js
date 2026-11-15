/**
 * dashboard.js  (frontend/js/dashboard.js)
 * 
 * Loads the user dashboard:
 *   - Checks auth (redirects to login if not authenticated)
 *   - Builds the sidebar with the logged-in user's info
 *   - Populates stat cards (total students, user role, etc.)
 *   - Populates recent activity from the audit log
 */

document.addEventListener('DOMContentLoaded', async () => {

  // Check authentication – redirects to login.html if not logged in
  const user = await checkAuth();
  if (!user) return;

  // Build the sidebar navigation
  buildSidebar(user);

  // Fill in the welcome message
  document.getElementById('welcome-name').textContent = user.full_name;
  document.getElementById('welcome-role').textContent = user.role;

  // Load stats and recent logs from the API
  await loadStats();
  await loadRecentLogs();
});

/**
 * loadStats()
 * Fetches the total student count and displays stat cards.
 */
async function loadStats() {
  try {
    const data = await apiFetch('/api/directory');
    if (data.success) {
      document.getElementById('stat-students').textContent = data.students.length;
    }
  } catch (err) {
    document.getElementById('stat-students').textContent = '—';
  }

  // Server status
  try {
    const data = await apiFetch('/api/diagnostics/status');
    if (data.success) {
      document.getElementById('stat-uptime').textContent = data.status.uptime;
    }
  } catch (err) {
    document.getElementById('stat-uptime').textContent = '—';
  }
}

/**
 * loadRecentLogs()
 * Fetches and displays the most recent audit log entries.
 */
async function loadRecentLogs() {
  const tbody = document.getElementById('log-tbody');
  try {
    const data = await apiFetch('/api/diagnostics/logs');
    if (data.success && data.logs.length > 0) {
      // Show only the 5 most recent
      const recent = data.logs.slice(0, 5);
      tbody.innerHTML = recent.map(log => `
        <tr>
          <td class="font-mono text-sm">${log.username}</td>
          <td><span class="badge badge-primary">${log.action}</span></td>
          <td class="text-muted text-sm">${formatDate(log.timestamp)}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No activity yet.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Could not load logs.</td></tr>';
  }
}
