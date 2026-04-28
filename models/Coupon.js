const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Please add a coupon code'],
    unique: true,
    uppercase: true,
    trim: true
  },
  discount: {
    type: Number,
    required: [true, 'Please add a discount percentage']
  },
  expiryDate: {
    type: Date,
    required: [true, 'Please add an expiry date']
  },
  minPurchase: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  image: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Coupon', couponSchema);
