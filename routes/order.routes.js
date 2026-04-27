const express = require('express');
const {
  createOrder,
  createCheckoutSession,
  getOrderById,
  getMyOrders,
  getOrders,
  updateOrderStatus,
  markOrderPaid,
  cancelMyOrder,
  deleteOrder
} = require('../controllers/order.controller');

const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin', 'manager'), getOrders)
  .post(protect, createOrder);

router.post('/checkout-session', protect, createCheckoutSession);

router.get('/myorders', protect, getMyOrders);

router.route('/:id')
  .get(protect, getOrderById)
  .delete(protect, authorize('admin', 'manager'), deleteOrder);

router.put('/:id/status', protect, authorize('admin', 'manager'), updateOrderStatus);
router.put('/:id/cancel', protect, cancelMyOrder);
router.put('/:id/mark-paid', protect, markOrderPaid);

module.exports = router;
