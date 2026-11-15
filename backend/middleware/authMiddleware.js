/**
 * authMiddleware.js
 * 
 * Middleware that protects backend API routes from unauthenticated access.
 * 
 * Usage:
 *   const { requireLogin, requireRole } = require('./authMiddleware');
 *   router.get('/protected', requireLogin, handler);
 *   router.delete('/admin-only', requireRole('admin'), handler);
 */

/**
 * requireLogin
 * Checks if the user has an active session.
 * Returns HTTP 401 if not logged in.
 */
function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'You must be logged in to access this resource.'
    });
  }
  // User is authenticated → continue to the next middleware or route handler
  next();
}

/**
 * requireRole(role)
 * Factory function that returns a middleware checking for a specific role.
 * Returns HTTP 403 if the user lacks the required role.
 * 
 * @param {string|string[]} allowedRoles - Role string or array of allowed roles
 */
function requireRole(allowedRoles) {
  // Allow passing a single string or an array of roles
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return function (req, res, next) {
    // First check authentication
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'You must be logged in to access this resource.'
      });
    }

    // Then check authorisation (role)
    const userRole = req.session.user.role;
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`
      });
    }

    // User has the required role → continue
    next();
  };
}

module.exports = { requireLogin, requireRole };
