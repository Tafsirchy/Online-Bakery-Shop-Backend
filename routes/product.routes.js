const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  applyGlobalOffer,
  applyProductOffer
} = require('../controllers/product.controller');

const { protect, authorize } = require('../middleware/auth.middleware');

// Include other resource routers
const reviewRouter = require('./review.routes');

const router = express.Router();

// Re-route into other resource routers
router.use('/:productId/reviews', reviewRouter);

router.route('/')
  .get(getProducts)
  .post(protect, authorize('admin', 'manager'), createProduct);

router.patch('/offers/global', protect, authorize('admin', 'manager'), applyGlobalOffer);
router.patch('/:id/offer', protect, authorize('admin', 'manager'), applyProductOffer);

router.route('/:id')
  .get(getProduct)
  .put(protect, authorize('admin', 'manager'), updateProduct)
  .delete(protect, authorize('admin'), deleteProduct);

module.exports = router;
