/**
 * diagnostics.js  (frontend/js/diagnostics.js)
 * 
 * Loads server status and audit log on the diagnostics page.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  buildSidebar(user);
  await loadStatus();
  await loadLogs();
});

async function loadStatus() {
  try {
    const data = await apiFetch('/api/diagnostics/status');
    if (!data.success) throw new Error(data.message);

    const s = data.status;
    document.getElementById('status-server').textContent   = s.server;
    document.getElementById('status-uptime').textContent   = s.uptime;
    document.getElementById('status-node').textContent     = s.node;
    document.getElementById('status-platform').textContent = s.platform;
    document.getElementById('status-memory').textContent   = s.memory;
    document.getElementById('status-time').textContent     = new Date(s.timestamp).toLocaleString();
  } catch (err) {
    showAlert('status-alert', 'Failed to load server status: ' + err.message, 'error');
  }
}

async function loadLogs() {
  const tbody = document.getElementById('log-tbody');
  try {
    const data = await apiFetch('/api/diagnostics/logs');
    if (!data.success) throw new Error(data.message);

    if (data.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No logs recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.logs.map(log => `
      <tr class="fade-in">
        <td class="text-sm">${log.id}</td>
        <td class="font-mono text-sm">${log.username}</td>
        <td><span class="badge badge-primary">${log.action}</span></td>
        <td class="text-muted text-sm">${log.target || '—'}</td>
        <td class="text-muted text-sm">${formatDate(log.timestamp)}</td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Error: ${err.message}</td></tr>`;
  }
}
