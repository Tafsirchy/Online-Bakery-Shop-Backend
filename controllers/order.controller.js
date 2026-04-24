const Order = require('../models/Order');
const Product = require('../models/Product');
const sendEmail = require('../services/mail.service');

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  const Stripe = require('stripe');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const buildOrderTrackingId = () => `BAK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const buildStripeLineItems = (products = []) => {
  return products.map((item) => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.name || 'Bakery Item',
        images: item.image ? [item.image] : item.images || [],
      },
      unit_amount: Math.round(Number(item.price || 0) * 100),
    },
    quantity: Number(item.quantity || 1),
  }));
};

const updateStockForOrder = async (products = []) => {
  for (const item of products) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { stock: -item.quantity }
    });
  }
};

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
      trackingId: buildOrderTrackingId()
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
          <p>Total Amount: <strong>$${Number(finalPrice).toFixed(2)}</strong></p>
          <p>Payment Method: ${paymentMethod}</p>
          <hr />
          <p>We'll notify you once your treats are on the way!</p>
        `
      });
    } catch (err) {
      console.error('Email could not be sent');
    }

    // Update product stock
    await updateStockForOrder(products);
    createdOrder.inventoryUpdated = true;
    await createdOrder.save();

    res.status(201).json({ success: true, data: createdOrder });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Create Stripe checkout session and pending order
// @route   POST /api/orders/checkout-session
// @access  Private
exports.createCheckoutSession = async (req, res) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe is not configured on server' });
    }

    const {
      products,
      shippingAddress,
      paymentMethod,
      totalPrice,
      discount,
      finalPrice
    } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ success: false, message: 'No order items' });
    }

    if (paymentMethod !== 'Stripe') {
      return res.status(400).json({ success: false, message: 'Invalid payment method for Stripe checkout' });
    }

    const order = await Order.create({
      userId: req.user.id,
      products,
      shippingAddress,
      paymentMethod,
      totalPrice,
      discount,
      finalPrice,
      trackingId: buildOrderTrackingId(),
      paymentStatus: 'Pending',
      inventoryUpdated: false,
    });

    const frontendBaseUrl = (process.env.CLIENT_URL || req.headers.origin || 'http://localhost:3000').replace(/\/+$/, '');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: req.user.email,
      line_items: buildStripeLineItems(products),
      metadata: {
        orderId: String(order._id),
        userId: String(req.user.id),
      },
      success_url: `${frontendBaseUrl}/checkout/success?orderId=${order._id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBaseUrl}/checkout?canceled=true&orderId=${order._id}`,
    });

    order.stripeSessionId = session.id;
    await order.save();

    res.status(200).json({
      success: true,
      sessionId: session.id,
      orderId: order._id,
    });
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

// @desc    Mark Stripe order as paid
// @route   PUT /api/orders/:id/mark-paid
// @access  Private
exports.markOrderPaid = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const isOwner = order.userId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'manager';

    if (!isOwner && !isAdmin) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    if (order.paymentMethod !== 'Stripe') {
      return res.status(400).json({ success: false, message: 'Order is not a Stripe order' });
    }

    if (!order.inventoryUpdated) {
      await updateStockForOrder(order.products);
      order.inventoryUpdated = true;
    }

    order.paymentStatus = 'Paid';
    if (order.status === 'Pending') {
      order.status = 'Processing';
    }

    await order.save();

    res.status(200).json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
