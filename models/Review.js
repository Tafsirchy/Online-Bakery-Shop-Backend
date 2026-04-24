const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true
  },
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: [true, 'Please add a rating between 1 and 5']
  },
  comment: {
    type: String,
    required: [true, 'Please add a comment']
  }
}, {
  timestamps: true
});

// Prevent user from submitting more than one review per product
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

// Static method to get avg rating and save
reviewSchema.statics.getAverageRating = async function(productId) {
  const obj = await this.aggregate([
    {
      $match: { productId: productId }
    },
    {
      $group: {
        _id: '$productId',
        averageRating: { $avg: '$rating' },
        numOfReviews: { $count: {} }
      }
    }
  ]);

  try {
    if (obj[0]) {
      await this.model('Product').findByIdAndUpdate(productId, {
        averageRating: Math.round(obj[0].averageRating * 10) / 10,
        numOfReviews: obj[0].numOfReviews
      });
    } else {
      await this.model('Product').findByIdAndUpdate(productId, {
        averageRating: 0,
        numOfReviews: 0
      });
    }
  } catch (err) {
    console.error(err);
  }
};

// Call getAverageRating after save
reviewSchema.post('save', async function() {
  await this.constructor.getAverageRating(this.productId);
});

// Call getAverageRating before remove
reviewSchema.post('remove', async function() {
  await this.constructor.getAverageRating(this.productId);
});

module.exports = mongoose.model('Review', reviewSchema);
