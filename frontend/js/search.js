/**
 * search.js  (frontend/js/search.js)
 * 
 * Handles the student search form and displays results.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  buildSidebar(user);

  const form    = document.getElementById('search-form');
  const input   = document.getElementById('search-input');
  const results = document.getElementById('search-results');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    results.innerHTML = '<p class="text-muted">Searching…</p>';

    try {
      const data = await apiFetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!data.success) throw new Error(data.message);

      if (data.results.length === 0) {
        results.innerHTML = `<p class="text-muted">No students found matching "<strong>${query}</strong>".</p>`;
        return;
      }

      results.innerHTML = `
        <p class="text-muted mb-md">${data.results.length} result(s) for "<strong>${query}</strong>"</p>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Email</th><th>Department</th><th>Year</th><th>GPA</th>
              </tr>
            </thead>
            <tbody>
              ${data.results.map(s => `
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
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

    } catch (err) {
      results.innerHTML = `<div class="alert alert-error"><span>❌</span> ${err.message}</div>`;
    }
  });
});
