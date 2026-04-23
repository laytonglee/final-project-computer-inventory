const express = require('express');
const router  = express.Router();
const { apiLogin } = require('../../controllers/authController');

// POST /api/auth/login
router.post('/login', apiLogin);

module.exports = router;
