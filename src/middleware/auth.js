const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const User   = require('../models/User');
const ApiKey = require('../models/ApiKey');

/**
 * authenticateJWT – verifies Bearer token from Authorization header.
 * Used exclusively for JSON API routes.
 */
const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Provide a valid Bearer token.' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('isActive role username');
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Account is disabled or not found.' });
    }
    req.user = { id: user._id, username: user.username, role: user.role };
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token has expired.' : 'Invalid token.';
    return res.status(401).json({ error: msg });
  }
};

/**
 * authenticateUI – verifies JWT stored in httpOnly cookie.
 * Used for browser-facing (HBS) routes. Redirects to /login on failure.
 */
const authenticateUI = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    req.flash('error', 'Please log in to continue.');
    return res.redirect('/login');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('isActive role username email');
    if (!user || !user.isActive) {
      res.clearCookie('token');
      req.flash('error', 'Your account has been disabled. Please contact an administrator.');
      return res.redirect('/login');
    }
    req.user = { id: user._id, username: user.username, role: user.role, email: user.email };
    res.locals.currentUser = req.user;
    next();
  } catch (err) {
    res.clearCookie('token');
    req.flash('error', 'Your session has expired. Please log in again.');
    return res.redirect('/login');
  }
};

/**
 * authenticateAny – accepts either a valid Bearer JWT **or** a valid x-api-key header.
 * Used for /api/items endpoints (GET) that should be accessible by integrations.
 */
const authenticateAny = async (req, res, next) => {
  // 1. Try Bearer JWT
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('isActive role username');
      if (user && user.isActive) {
        req.user = { id: user._id, username: user.username, role: user.role };
        return next();
      }
      return res.status(401).json({ error: 'Account is disabled.' });
    } catch (err) {
      const msg = err.name === 'TokenExpiredError' ? 'Token has expired.' : 'Invalid token.';
      return res.status(401).json({ error: msg });
    }
  }

  // 2. Try x-api-key header
  const rawKey = req.headers['x-api-key'];
  if (rawKey) {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await ApiKey.findOne({ keyHash, isActive: true })
      .select('+keyHash')
      .populate({ path: 'createdBy', select: 'isActive role username' });

    if (apiKey && apiKey.createdBy?.isActive) {
      req.user = { id: apiKey.createdBy._id, username: apiKey.createdBy.username, role: apiKey.createdBy.role, apiKeyUsed: true };
      return next();
    }
    return res.status(401).json({ error: 'Invalid or revoked API key.' });
  }

  return res.status(401).json({ error: 'Authentication required.' });
};

module.exports = { authenticateJWT, authenticateUI, authenticateAny };
