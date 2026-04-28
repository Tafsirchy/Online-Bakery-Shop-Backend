const express = require('express');
const { getSettings, updateSettings } = require('../controllers/settings.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', getSettings);
router.put('/', protect, authorize('admin', 'manager'), updateSettings);

module.exports = router;
