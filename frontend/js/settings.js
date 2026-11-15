/**
 * settings.js  (frontend/js/settings.js)
 * 
 * Loads the user's profile and handles the update-profile form.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  buildSidebar(user);
  await loadProfile();

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const full_name = document.getElementById('input-name').value.trim();
    const email     = document.getElementById('input-email').value.trim();

    if (!full_name || !email) {
      showAlert('settings-alert', 'Name and email cannot be empty.', 'warning');
      return;
    }

    const data = await apiFetch('/api/settings/update-profile', {
      method: 'POST',
      body: JSON.stringify({ full_name, email })
    });

    if (data.success) {
      showAlert('settings-alert', 'Profile updated successfully!', 'success');
    } else {
      showAlert('settings-alert', data.message || 'Update failed.', 'error');
    }
  });
});

async function loadProfile() {
  try {
    const data = await apiFetch('/api/settings/profile');
    if (!data.success) throw new Error(data.message);

    const p = data.profile;
    document.getElementById('profile-username').textContent  = p.username;
    document.getElementById('profile-role').textContent      = p.role;
    document.getElementById('profile-joined').textContent    = formatDate(p.created_at);
    document.getElementById('input-name').value              = p.full_name;
    document.getElementById('input-email').value             = p.email;
    document.getElementById('profile-avatar').textContent    = p.full_name.charAt(0).toUpperCase();
  } catch (err) {
    showAlert('settings-alert', 'Failed to load profile: ' + err.message, 'error');
  }
}
