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
  .post(protect, createOrder);

router.post('/checkout-session', protect, createCheckoutSession);

router.get('/myorders', protect, getMyOrders);
router.get('/stats', protect, authorize('admin', 'manager'), getDashboardStats);
router.get('/:id', protect, getOrderById);
router.put('/:id/status', protect, authorize('admin', 'manager'), updateOrderStatus);
router.put('/:id/mark-paid', protect, markOrderPaid);
router.put('/:id/cancel', protect, cancelMyOrder);
router.delete('/:id', protect, authorize('admin', 'manager'), deleteOrder);

// Admin and Manager access
router.get('/', protect, authorize('admin', 'manager'), getOrders);

module.exports = router;
