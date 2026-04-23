const express = require('express');
const router  = express.Router();
const { authenticateJWT }        = require('../../middleware/auth');
const { requireRole }            = require('../../middleware/rbac');
const { generateKey, listKeys, revokeKey } = require('../../controllers/keyController');

// All /api/keys routes require JWT + Admin
router.use(authenticateJWT, requireRole('Admin'));

// POST   /api/keys         – generate new API key
router.post('/',    generateKey);

// GET    /api/keys         – list all keys
router.get('/',     listKeys);

// DELETE /api/keys/:id     – revoke/delete a key
router.delete('/:id', revokeKey);

module.exports = router;
