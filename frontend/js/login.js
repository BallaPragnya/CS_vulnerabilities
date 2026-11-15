/**
 * login.js  (frontend/js/login.js)
 * 
 * Handles the login form submission.
 * On success: redirects to dashboard.html
 * On failure: shows an error message below the form
 */

// Wait for the DOM to be fully loaded before running
document.addEventListener('DOMContentLoaded', async () => {

  // If the user is already logged in, skip the login page
  try {
    const data = await fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json());
    if (data.success) {
      window.location.href = '/dashboard.html';
      return;
    }
  } catch (err) {
    // Not logged in – that's fine, stay on this page
  }

  // Get references to the DOM elements
  const loginForm   = document.getElementById('login-form');
  const alertBox    = document.getElementById('alert-box');
  const submitBtn   = document.getElementById('submit-btn');
  const btnText     = document.getElementById('btn-text');
  const btnSpinner  = document.getElementById('btn-spinner');

  /**
   * handleLogin(event)
   * Called when the login form is submitted.
   * Sends a POST request to /api/auth/login with the form data.
   */
  loginForm.addEventListener('submit', async (event) => {
    // Prevent the browser's default form submission (page reload)
    event.preventDefault();

    // Read the form field values
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // Basic client-side validation
    if (!username || !password) {
      showLoginAlert('Please enter both username and password.', 'error');
      return;
    }

    // Show loading state on the button
    setLoading(true);
    clearAlert();

    try {
      // Send the login request to the backend
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',           // Send cookies
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data.success) {
        // Show a brief success message then redirect
        showLoginAlert(`Welcome, ${data.user.full_name}! Redirecting…`, 'success');
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 800);
      } else {
        // Show the error returned by the server
        showLoginAlert(data.message || 'Login failed. Please try again.', 'error');
        setLoading(false);
      }

    } catch (err) {
      // Network error or server not running
      showLoginAlert('Cannot connect to the server. Make sure the backend is running.', 'error');
      setLoading(false);
    }
  });

  // ── Helper functions ────────────────────────────────────────────────────────

  /** Shows an alert message below the form */
  function showLoginAlert(message, type) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    alertBox.className = `alert alert-${type} fade-in`;
    alertBox.innerHTML = `<span>${icons[type]}</span> <span>${message}</span>`;
  }

  /** Clears the alert box */
  function clearAlert() {
    alertBox.innerHTML = '';
    alertBox.className = 'alert';
  }

  /** Toggles the loading spinner and disables the button */
  function setLoading(loading) {
    submitBtn.disabled = loading;
    btnText.textContent = loading ? 'Signing in…' : 'Sign In';
    btnSpinner.style.display = loading ? 'inline' : 'none';
  }
});
