const express = require('express');
const router  = express.Router();
const { authenticateJWT }               = require('../../middleware/auth');
const upload                            = require('../../middleware/upload');
const { checkout, checkin }             = require('../../controllers/transactionController');

// POST /api/transactions/checkout  – JWT, multipart
router.post('/checkout', authenticateJWT, upload.single('document'), checkout);

// POST /api/transactions/checkin   – JWT, multipart
router.post('/checkin',  authenticateJWT, upload.single('document'), checkin);

module.exports = router;
