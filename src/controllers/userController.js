const bcrypt  = require('bcryptjs');
const User    = require('../models/User');
const ApiKey  = require('../models/ApiKey');

// POST /api/users  (Admin only)
const createUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'username, email, password, and role are required.' });
    }
    if (!['Admin', 'Technician'].includes(role)) {
      return res.status(400).json({ error: 'Role must be Admin or Technician.' });
    }

    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) return res.status(409).json({ error: 'Username or email already in use.' });

    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({ username, email, password: hashed, role });

    res.status(201).json({
      message: 'User created.',
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[userController.createUser]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// PATCH /api/users/:id/role  (Admin only)
const updateRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['Admin', 'Technician'].includes(role)) {
      return res.status(400).json({ error: 'Role must be Admin or Technician.' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'Role updated.', user: { id: user._id, role: user.role } });
  } catch (err) {
    console.error('[userController.updateRole]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// PATCH /api/users/:id/status  (Admin only)
const updateStatus = async (req, res) => {
  try {
    const isActive = req.body.isActive;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean.' });
    }

    // Prevent admin from disabling their own account
    if (String(req.params.id) === String(req.user.id) && !isActive) {
      return res.status(400).json({ error: 'You cannot disable your own account.' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Revoke all API keys when disabling a user
    if (!isActive) {
      await ApiKey.updateMany({ createdBy: user._id }, { isActive: false });
    }

    res.json({
      message: `User ${isActive ? 'enabled' : 'disabled'}.`,
      user:    { id: user._id, isActive: user.isActive },
    });
  } catch (err) {
    console.error('[userController.updateStatus]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// GET /api/users  (Admin only — used by UI & API)
const listUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    console.error('[userController.listUsers]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = { createUser, updateRole, updateStatus, listUsers };
