const express = require('express');
const {
  getCoupons,
  createCoupon,
  validateCoupon,
  deleteCoupon
} = require('../controllers/coupon.controller');

const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/validate', protect, validateCoupon);

router.route('/')
  .get(protect, authorize('admin', 'manager'), getCoupons)
  .post(protect, authorize('admin'), createCoupon);

router.route('/:id')
  .delete(protect, authorize('admin'), deleteCoupon);

module.exports = router;
