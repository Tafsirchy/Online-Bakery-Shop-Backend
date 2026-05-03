const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const sendEmail = require('../services/mail.service');
const { orderConfirmationTemplate, orderStatusUpdateTemplate } = require('../utils/emailTemplates');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Stripe = require('stripe');

const sendOrderConfirmation = async (user, order) => {
  try {
    await sendEmail({
      email: user.email,
      subject: '✅ Order Confirmed - Bakery & Co.',
      html: orderConfirmationTemplate(user, order)
    });
  } catch (err) {
    console.error('Order confirmation email could not be sent', err);
  }
};

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const buildOrderTrackingId = () => `BAK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const toSafeNumber = (value, defaultValue = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

const normalizeOrderProducts = async (rawProducts = []) => {
  if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
    throw new Error('No order items');
  }

  const quantitiesByProductId = new Map();
  const invalidProductIds = [];

  for (const rawItem of rawProducts) {
    const productId = String(rawItem?.productId || '').trim();
    const quantity = Math.floor(toSafeNumber(rawItem?.quantity, 0));

    if (!isValidObjectId(productId)) {
      invalidProductIds.push(productId || 'unknown');
      continue;
    }

    if (quantity < 1) {
      throw new Error(`Invalid quantity for product ${productId}`);
    }

    const currentQty = quantitiesByProductId.get(productId) || 0;
    quantitiesByProductId.set(productId, currentQty + quantity);
  }

  if (invalidProductIds.length > 0) {
    throw new Error(`Invalid product IDs: ${invalidProductIds.join(', ')}`);
  }

  const productIds = [...quantitiesByProductId.keys()];
  const dbProducts = await Product.find({ _id: { $in: productIds } }).select('name price discountPrice images stock');
  const dbProductMap = new Map(dbProducts.map((product) => [String(product._id), product]));

  const missingProducts = productIds.filter((productId) => !dbProductMap.has(productId));

  const orderProducts = [];
  let subtotal = 0;
  const outOfStockProducts = [];

  for (const productId of productIds) {
    const product = dbProductMap.get(productId);
    const quantity = quantitiesByProductId.get(productId);

    if (!product) {
      continue;
    }

    const currentStock = toSafeNumber(product.stock, 0);
    if (currentStock < quantity) {
      outOfStockProducts.push(product.name);
      continue;
    }

    const unitPrice = toSafeNumber(product.discountPrice, 0) > 0
      ? toSafeNumber(product.discountPrice, 0)
      : toSafeNumber(product.price, 0);

    if (unitPrice <= 0) {
      throw new Error(`Invalid price for ${product.name}`);
    }

    subtotal += unitPrice * quantity;

    orderProducts.push({
      productId: product._id,
      name: product.name,
      quantity,
      price: unitPrice,
      image: product.images?.[0] || '',
    });
  }

  if (orderProducts.length === 0) {
    const unavailable = [...missingProducts, ...outOfStockProducts].filter(Boolean);
    const errorMsg = unavailable.length > 0
      ? `Some products are unavailable: ${unavailable.join(', ')}`
      : 'No valid products available for checkout';
    console.log('Order Normalization Failed:', errorMsg, { missingProducts, outOfStockProducts });
    throw new Error(errorMsg);
  }

  const unavailable = [...missingProducts, ...outOfStockProducts].filter(Boolean);

  return {
    orderProducts,
    subtotal: Number(subtotal.toFixed(2)),
    missingProducts: unavailable,
  };
};

const buildStripeLineItems = ({ orderProducts = [], chargeAmount = 0, shippingFee = 0, discountAmount = 0 }) => {
  const description = [
    `${orderProducts.length} item(s)`,
    `Shipping: ${shippingFee.toFixed(2)}`,
    `Discount: ${discountAmount.toFixed(2)}`,
  ].join(' | ');

  return [{
    price_data: {
      currency: 'bdt',
      product_data: {
        name: 'Bakery & Co. Order',
        description,
      },
      unit_amount: Math.round(Number(chargeAmount || 0) * 100),
    },
    quantity: 1,
  }];
};

const updateStockForOrder = async (products = []) => {
  for (const item of products) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { stock: -item.quantity }
    });
  }
};

exports.handleStripeWebhook = async (req, res) => {
  await connectDB();
  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(500).send('Stripe is not configured on server');
  }

  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(500).send('Stripe webhook secret is not configured');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error(`Stripe webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;

    if (!orderId) {
      return res.status(200).json({ received: true, skipped: true });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(200).json({ received: true, skipped: true });
    }

    if (order.paymentStatus !== 'Paid') {
      const expectedAmount = Math.round(toSafeNumber(order.finalPrice, 0) * 100);
      if (session.amount_total !== expectedAmount) {
        console.error(`Stripe amount mismatch for order ${orderId}`);
        return res.status(400).json({ received: true, error: 'Amount mismatch' });
      }

      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId, paymentStatus: { $ne: 'Paid' } },
        { $set: { paymentStatus: 'Paid', status: 'Processing' } },
        { new: true }
      ).populate('userId', 'name email');

      if (updatedOrder) {
        const inventoryCheck = await Order.findOneAndUpdate(
          { _id: orderId, inventoryUpdated: false },
          { $set: { inventoryUpdated: true } }
        );

        if (inventoryCheck) {
          await updateStockForOrder(updatedOrder.products);
        }

        await sendOrderConfirmation(updatedOrder.userId, updatedOrder);
      }
    }
  }

  return res.status(200).json({ received: true });
};

// Create new order
exports.createOrder = async (req, res) => {
  try {
    await connectDB();
    const {
      products,
      shippingAddress,
      paymentMethod,
      couponCode
    } = req.body;

    const { orderProducts, subtotal, missingProducts } = await normalizeOrderProducts(products);
    const safeShippingFee = 60; // Flat fee
    let safeDiscount = 0;

    if (couponCode) {
      const coupon = await Coupon.findOne({ 
        code: { $regex: new RegExp(`^${String(couponCode).trim()}$`, 'i') }, 
        isActive: true,
        expiryDate: { $gt: new Date() }
      });
      if (coupon && subtotal >= (coupon.minPurchase || 0)) {
        safeDiscount = (subtotal * coupon.discount) / 100;
      }
    }

    const computedFinalPrice = Number((subtotal + safeShippingFee - safeDiscount).toFixed(2));

    const order = new Order({
      userId: req.user.id,
      products: orderProducts,
      shippingAddress,
      paymentMethod,
      totalPrice: subtotal,
      shippingFee: safeShippingFee,
      discount: safeDiscount,
      finalPrice: computedFinalPrice,
      trackingId: buildOrderTrackingId()
    });

    const createdOrder = await order.save();

    await sendOrderConfirmation(req.user, createdOrder);

    // Update product stock
    await updateStockForOrder(orderProducts);
    createdOrder.inventoryUpdated = true;
    await createdOrder.save();

    res.status(201).json({
      success: true,
      data: createdOrder,
      warnings: missingProducts,
    });
  } catch (err) {
    console.error('Order Creation Error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
};

// Create Stripe checkout session
exports.createCheckoutSession = async (req, res) => {
  try {
    await connectDB();
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe is not configured on server' });
    }

    const {
      products,
      shippingAddress,
      paymentMethod,
      couponCode
    } = req.body;

    const { orderProducts, subtotal, missingProducts } = await normalizeOrderProducts(products);
    const safeShippingFee = 60; // Flat fee
    let safeDiscount = 0;

    if (couponCode) {
      const coupon = await Coupon.findOne({ 
        code: { $regex: new RegExp(`^${String(couponCode).trim()}$`, 'i') }, 
        isActive: true,
        expiryDate: { $gt: new Date() }
      });
      if (coupon && subtotal >= (coupon.minPurchase || 0)) {
        safeDiscount = (subtotal * coupon.discount) / 100;
      }
    }

    const computedFinalPrice = Number((subtotal + safeShippingFee - safeDiscount).toFixed(2));

    if (computedFinalPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid final payment amount' });
    }

    if (paymentMethod !== 'Stripe') {
      return res.status(400).json({ success: false, message: 'Invalid payment method for Stripe checkout' });
    }

    const order = await Order.create({
      userId: req.user.id,
      products: orderProducts,
      shippingAddress,
      paymentMethod,
      totalPrice: subtotal,
      shippingFee: safeShippingFee,
      discount: safeDiscount,
      finalPrice: computedFinalPrice,
      trackingId: buildOrderTrackingId(),
      paymentStatus: 'Pending',
      inventoryUpdated: false,
    });

    const frontendBaseUrl = (process.env.CLIENT_URL || req.headers.origin || 'http://localhost:3000').replace(/\/+$/, '');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: req.user.email,
      line_items: buildStripeLineItems({
        orderProducts,
        chargeAmount: computedFinalPrice,
        shippingFee: safeShippingFee,
        discountAmount: safeDiscount,
      }),
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
      sessionUrl: session.url,
      orderId: order._id,
      warnings: missingProducts,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
  try {
    await connectDB();
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

// Get logged in user orders
exports.getMyOrders = async (req, res) => {
  try {
    await connectDB();
    const orders = await Order.find({ userId: req.user.id }).sort('-createdAt');
    res.status(200).json({ success: true, data: orders });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Get all orders
exports.getOrders = async (req, res) => {
  try {
    await connectDB();
    const orders = await Order.find().populate('userId', 'id name').sort('-createdAt');
    res.status(200).json({ success: true, data: orders });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    await connectDB();
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = req.body.status || order.status;
    order.paymentStatus = req.body.paymentStatus || order.paymentStatus;

    const updatedOrder = await order.save();

    // Send order status update email
    if (req.body.status && req.body.status !== order.status) {
      const user = await User.findById(order.userId);
      if (user) {
        sendEmail({
          email: user.email,
          subject: `Order Update: ${req.body.status} - Bakery & Co.`,
          html: orderStatusUpdateTemplate(user, { ...updatedOrder.toObject(), status: req.body.status })
        }).catch(err => console.error('Status update email failed:', err));
      }
    }

    res.status(200).json({ success: true, data: updatedOrder });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Mark Stripe order as paid
exports.markOrderPaid = async (req, res) => {
  try {
    await connectDB();
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

    if (order.paymentStatus === 'Paid') {
      return res.status(200).json({ success: true, data: order });
    }

    const providedSessionId = String(req.body?.sessionId || req.query?.session_id || req.query?.sessionId || '').trim();

    if (!providedSessionId) {
      return res.status(400).json({ success: false, message: 'Stripe session ID is required' });
    }

    if (!order.stripeSessionId || providedSessionId !== order.stripeSessionId) {
      return res.status(400).json({ success: false, message: 'Invalid Stripe session for this order' });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe is not configured on server' });
    }

    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Stripe payment is not completed yet' });
    }

    const expectedAmount = Math.round(toSafeNumber(order.finalPrice, 0) * 100);
    if (session.amount_total !== expectedAmount) {
      return res.status(400).json({ success: false, message: 'Stripe payment amount mismatch' });
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: { $ne: 'Paid' } },
      { $set: { paymentStatus: 'Paid', status: 'Processing' } },
      { new: true }
    ).populate('userId', 'name email');

    if (updatedOrder) {
      const inventoryCheck = await Order.findOneAndUpdate(
        { _id: order._id, inventoryUpdated: false },
        { $set: { inventoryUpdated: true } }
      );

      if (inventoryCheck) {
        await updateStockForOrder(updatedOrder.products);
      }
      
      await sendOrderConfirmation(updatedOrder.userId, updatedOrder);
      return res.status(200).json({ success: true, data: updatedOrder });
    } else {
      const alreadyPaidOrder = await Order.findById(order._id);
      return res.status(200).json({ success: true, data: alreadyPaidOrder });
    }
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Cancel an order
exports.cancelMyOrder = async (req, res) => {
  try {
    await connectDB();
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.userId.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized to cancel this order' });
    }

    if (order.status !== 'Pending' && order.status !== 'Processing') {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });
    }

    // Restore inventory if it was updated
    if (order.inventoryUpdated) {
      for (const item of order.products) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      }
      order.inventoryUpdated = false;
    }

    order.status = 'Cancelled';
    await order.save();

    res.status(200).json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
// Delete order
exports.deleteOrder = async (req, res) => {
  try {
    await connectDB();
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    await order.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Get dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    await connectDB();
    
    // Total Revenue & Orders (exclude cancelled)
    const orders = await Order.find({ status: { $ne: 'Cancelled' } });
    const totalRevenue = orders.reduce((acc, order) => acc + (order.finalPrice || 0), 0);
    const totalOrders = orders.length;

    // Total Users (all roles)
    const totalUsers = await User.countDocuments();

    // Avg Order Value
    const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: Math.round(totalRevenue),
        totalOrders,
        totalUsers,
        avgOrderValue: Number(avgOrderValue)
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
