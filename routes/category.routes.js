const express = require('express');
const {
  getCategories,
  getAdminCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/category.controller');

const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.route('/')
  .get(getCategories)
  .post(protect, authorize('admin', 'manager'), createCategory);

router.get('/admin', protect, authorize('admin', 'manager'), getAdminCategories);

router.route('/:id')
  .get(getCategory)
  .put(protect, authorize('admin', 'manager'), updateCategory)
  .delete(protect, authorize('admin', 'manager'), deleteCategory);

module.exports = router;
