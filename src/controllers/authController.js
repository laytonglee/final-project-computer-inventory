const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');

// POST /api/auth/login  → returns JWT
const apiLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await User.findOne({ username }).select('+password');
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    if (!user.isActive) return res.status(401).json({ error: 'Account is disabled.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' },
    );

    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[authController.apiLogin]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// POST /login  → sets httpOnly cookie + redirect (UI)
const uiLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password))) {
      req.flash('error', 'Invalid username or password.');
      return res.redirect('/login');
    }
    if (!user.isActive) {
      req.flash('error', 'Your account has been disabled. Contact an administrator.');
      return res.redirect('/login');
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' },
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   8 * 60 * 60 * 1000,
    });

    res.redirect('/dashboard');
  } catch (err) {
    console.error('[authController.uiLogin]', err);
    req.flash('error', 'Server error. Please try again.');
    res.redirect('/login');
  }
};

// GET /logout
const logout = (req, res) => {
  res.clearCookie('token');
  req.flash('success', 'You have been logged out.');
  res.redirect('/login');
};

module.exports = { apiLogin, uiLogin, logout };
