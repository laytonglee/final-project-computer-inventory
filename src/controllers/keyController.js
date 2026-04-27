const crypto = require('crypto');
const ApiKey = require('../models/ApiKey');

// POST /api/keys  (Admin only)
const generateKey = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Key name is required.' });
    }

    // Generate a cryptographically secure random key
    const rawKey  = crypto.randomBytes(32).toString('hex'); // 64 hex chars
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix  = rawKey.slice(0, 8);

    const apiKey = await ApiKey.create({
      name:      name.trim(),
      keyHash,
      prefix,
      createdBy: req.user.id,
    });

    // Return the raw key ONCE — it is never retrievable again
    res.status(201).json({
      message: 'API key generated. Copy the key now — it will NOT be shown again.',
      key: {
        id:        apiKey._id,
        name:      apiKey.name,
        rawKey,            // shown once
        prefix:    apiKey.prefix,
        createdAt: apiKey.createdAt,
      },
    });
  } catch (err) {
    console.error('[keyController.generateKey]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// GET /api/keys  (Admin only)
const listKeys = async (req, res) => {
  try {
    const keys = await ApiKey.find()
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });

    res.json({ count: keys.length, keys });
  } catch (err) {
    console.error('[keyController.listKeys]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// DELETE /api/keys/:id  (Admin only)
const revokeKey = async (req, res) => {
  try {
    const key = await ApiKey.findById(req.params.id);
    if (!key) return res.status(404).json({ error: 'API key not found.' });

    await key.deleteOne();
    res.json({ message: 'API key revoked and deleted.' });
  } catch (err) {
    console.error('[keyController.revokeKey]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = { generateKey, listKeys, revokeKey };
