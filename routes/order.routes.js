const express = require('express');
const {
  createOrder,
  getOrderById,
  getMyOrders,
  getOrders,
  updateOrderStatus
} = require('../controllers/order.controller');

const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin', 'manager'), getOrders)
  .post(protect, createOrder);

router.get('/myorders', protect, getMyOrders);

router.route('/:id')
  .get(protect, getOrderById);

router.put('/:id/status', protect, authorize('admin', 'manager'), updateOrderStatus);

module.exports = router;
