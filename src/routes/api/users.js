const express  = require('express');
const router   = express.Router();
const { authenticateJWT }           = require('../../middleware/auth');
const { requireRole }               = require('../../middleware/rbac');
const { createUser, updateRole, updateStatus, listUsers } = require('../../controllers/userController');

// All /api/users routes require JWT + Admin role
router.use(authenticateJWT, requireRole('Admin'));

// POST /api/users
router.post('/', createUser);

// GET /api/users
router.get('/', listUsers);

// PATCH /api/users/:id/role
router.patch('/:id/role', updateRole);

// PATCH /api/users/:id/status
router.patch('/:id/status', updateStatus);

module.exports = router;
