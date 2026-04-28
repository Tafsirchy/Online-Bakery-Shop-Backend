const mongoose = require('mongoose');

const globalSettingsSchema = new mongoose.Schema({
  showOfferSlider: {
    type: Boolean,
    default: false
  },
  offers: [
    {
      title: String,
      description: String,
      couponCode: String,
      discount: {
        type: Number,
        default: 0
      },
      minPurchase: {
        type: Number,
        default: 0
      },
      image: String,
      isActive: {
        type: Boolean,
        default: true
      }
    }
  ]
}, {
  timestamps: true
});

module.exports = mongoose.model('GlobalSettings', globalSettingsSchema);
