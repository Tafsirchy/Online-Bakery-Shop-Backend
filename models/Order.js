const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  products: [
    {
      productId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Product',
        required: true
      },
      name: String,
      quantity: {
        type: Number,
        required: true
      },
      price: {
        type: Number,
        required: true
      },
      image: {
        type: String,
        default: ''
      }
    }
  ],
  totalPrice: {
    type: Number,
    required: true
  },
  shippingFee: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  finalPrice: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['Stripe', 'COD'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Pending'
  },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  shippingAddress: {
    street: String,
    city: String,
    zipCode: String,
    country: String,
    phone: String
  },
  trackingId: {
    type: String,
    unique: true
  },
  stripeSessionId: {
    type: String,
    default: null
  },
  inventoryUpdated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);
