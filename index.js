const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB().catch((error) => {
  console.error(`MongoDB connection failed during startup: ${error.message}`);
});

const app = express();

// Routes
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const couponRoutes = require('./routes/coupon.routes');
const orderRoutes = require('./routes/order.routes');

// Middleware
app.use(cors());
app.use(morgan('dev'));

const { handleStripeWebhook } = require('./controllers/order.controller');

// Stripe webhook must receive the raw body for signature verification.
app.post('/api/orders/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json());

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/orders', orderRoutes);

// Basic Route
app.get('/', (req, res) => {
  res.send('Online Bakery Shop API is running...');
});

// Port
const PORT = process.env.PORT || 5000;

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
