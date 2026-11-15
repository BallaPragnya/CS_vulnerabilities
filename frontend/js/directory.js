/**
 * directory.js  (frontend/js/directory.js)
 * 
 * Loads and displays the student directory table.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  buildSidebar(user);
  await loadDirectory();
});

async function loadDirectory() {
  const tbody = document.getElementById('dir-tbody');
  const countEl = document.getElementById('student-count');

  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading…</td></tr>';

  try {
    const data = await apiFetch('/api/directory');
    if (!data.success) throw new Error(data.message);

    countEl.textContent = `${data.students.length} student${data.students.length !== 1 ? 's' : ''}`;

    if (data.students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No students found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.students.map(s => `
      <tr class="fade-in">
        <td class="font-mono text-sm">${s.student_id}</td>
        <td><strong>${s.full_name}</strong></td>
        <td class="text-muted">${s.email}</td>
        <td>${s.department}</td>
        <td class="text-center">${s.year}</td>
        <td class="text-center">
          <span class="badge ${s.gpa >= 3.5 ? 'badge-success' : s.gpa >= 2.5 ? 'badge-warning' : 'badge-danger'}">
            ${s.gpa.toFixed(1)}
          </span>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Error: ${err.message}</td></tr>`;
  }
}
