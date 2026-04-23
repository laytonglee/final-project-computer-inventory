const express = require('express');
const router  = express.Router();
const { authenticateJWT, authenticateAny } = require('../../middleware/auth');
const { requireRole }                      = require('../../middleware/rbac');
const {
  listItems, getItem, createItem, updateItem, deleteItem, getItemHistory,
} = require('../../controllers/itemController');

// GET /api/items          – JWT or API Key
router.get('/',    authenticateAny, listItems);

// GET /api/items/:id      – JWT or API Key
router.get('/:id', authenticateAny, getItem);

// GET /api/items/:id/history  – JWT only
router.get('/:id/history', authenticateJWT, getItemHistory);

// POST /api/items         – JWT only
router.post('/', authenticateJWT, createItem);

// PUT /api/items/:id      – JWT only
router.put('/:id', authenticateJWT, updateItem);

// DELETE /api/items/:id   – JWT + Admin only (soft delete)
router.delete('/:id', authenticateJWT, requireRole('Admin'), deleteItem);

module.exports = router;
