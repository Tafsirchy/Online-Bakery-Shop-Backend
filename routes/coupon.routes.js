const express = require('express');
const {
  getCoupons,
  getPublicCoupons,
  createCoupon,
  validateCoupon,
  deleteCoupon,
  updateCoupon
} = require('../controllers/coupon.controller');

const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/validate', protect, validateCoupon);

router.get('/public', getPublicCoupons);

router.route('/')
  .get(protect, authorize('admin', 'manager'), getCoupons)
  .post(protect, authorize('admin', 'manager'), createCoupon);

router.route('/:id')
  .put(protect, authorize('admin', 'manager'), updateCoupon)
  .delete(protect, authorize('admin', 'manager'), deleteCoupon);

module.exports = router;
