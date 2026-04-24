/**
 * requireRole(...roles) – RBAC middleware factory.
 * Must be used AFTER an authenticate* middleware so req.user is populated.
 *
 * Usage:  router.delete('/:id', authenticateJWT, requireRole('Admin'), handler)
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    if (req.path.startsWith('/api') || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    req.flash('error', 'Please log in to continue.');
    return res.redirect('/login');
  }

  if (!roles.includes(req.user.role)) {
    if (req.path.startsWith('/api') || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    req.flash('error', 'Access denied. You do not have permission for this action.');
    return res.redirect('/dashboard');
  }

  next();
};

module.exports = { requireRole };
