const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Please add a price']
  },
  discountPrice: {
    type: Number,
    default: 0
  },
  isGlobalOffer: {
    type: Boolean,
    default: false
  },
  previousDiscountPrice: {
    type: Number,
    default: 0
  },
  category: {
    type: String,
    required: [true, 'Please add a category']
  },
  images: {
    type: [String],
    default: []
  },
  stock: {
    type: Number,
    required: [true, 'Please add stock quantity'],
    default: 0
  },
  averageRating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot be more than 5'],
    default: 0
  },
  numOfReviews: {
    type: Number,
    default: 0
  },
  ingredients: {
    type: [String],
    default: []
  },
  healthBenefits: {
    type: [String],
    default: []
  },
  isFeatured: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Cascade delete reviews when a product is deleted
productSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  await this.model('Review').deleteMany({ productId: this._id });
  next();
});

// Reverse populate with virtuals
productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'productId',
  justOne: false
});

module.exports = mongoose.model('Product', productSchema);
