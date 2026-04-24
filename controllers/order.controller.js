const Order = require('../models/Order');
const Product = require('../models/Product');
const sendEmail = require('../services/mail.service');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  try {
    const {
      products,
      shippingAddress,
      paymentMethod,
      totalPrice,
      discount,
      finalPrice
    } = req.body;

    if (products && products.length === 0) {
      return res.status(400).json({ success: false, message: 'No order items' });
    }

    const order = new Order({
      userId: req.user.id,
      products,
      shippingAddress,
      paymentMethod,
      totalPrice,
      discount,
      finalPrice,
      trackingId: `BAK-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    });

    const createdOrder = await order.save();

    // Send confirmation email
    try {
      await sendEmail({
        email: req.user.email,
        subject: 'Order Confirmation - The Cozy Bakery',
        html: `
          <h1>Thank you for your order, ${req.user.name}!</h1>
          <p>Your order <strong>${createdOrder.trackingId}</strong> has been received and is being prepared.</p>
          <p>Total Amount: <strong>$${finalTotal.toFixed(2)}</strong></p>
          <p>Payment Method: ${paymentMethod}</p>
          <hr />
          <p>We'll notify you once your treats are on the way!</p>
        `
      });
    } catch (err) {
      console.error('Email could not be sent');
    }

    // Update product stock
    for (const item of products) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity }
      });
    }

    res.status(201).json({ success: true, data: createdOrder });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('userId', 'name email');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Only allow user who made the order or admin to see it
    if (order.userId._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    res.status(200).json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
exports.getMyOrders = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      const mockOrders = [
        {
          _id: 'o1',
          trackingId: 'BAK-12345',
          finalPrice: 45.50,
          status: 'Processing',
          createdAt: new Date(),
          products: [{ name: 'Chocolate Cake', quantity: 1, price: 35 }]
        }
      ];
      return res.status(200).json({ success: true, data: mockOrders });
    }
    const orders = await Order.find({ userId: req.user.id }).sort('-createdAt');
    res.status(200).json({ success: true, data: orders });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private (Admin/Manager)
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate('userId', 'id name').sort('-createdAt');
    res.status(200).json({ success: true, data: orders });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Admin/Manager)
exports.updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = req.body.status || order.status;
    order.paymentStatus = req.body.paymentStatus || order.paymentStatus;

    const updatedOrder = await order.save();

    res.status(200).json({ success: true, data: updatedOrder });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
