const Product = require('../models/Product');
const connectDB = require('../config/db');

const roundPrice = (value) => Number(Number(value).toFixed(2));

// @desc    Get all products
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    await connectDB();

    let query;

    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit', 'search'];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);

    // Build Mongo filters, including support for bracket syntax such as price[gte]=0
    const mongoFilters = {};
    const bracketOperatorRegex = /^(.+)\[(gt|gte|lt|lte|in)\]$/;

    for (const [rawKey, rawValue] of Object.entries(reqQuery)) {
      const key = String(rawKey || '');
      const value = rawValue;
      const bracketMatch = key.match(bracketOperatorRegex);
      
      let finalValue = value;
      if (value === 'true') finalValue = true;
      if (value === 'false') finalValue = false;

      if (bracketMatch) {
        const field = bracketMatch[1];
        const op = bracketMatch[2];

        if (!mongoFilters[field] || typeof mongoFilters[field] !== 'object') {
          mongoFilters[field] = {};
        }

        if (op === 'in') {
          mongoFilters[field][`$${op}`] = String(finalValue)
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
        } else {
          const maybeNumber = Number(finalValue);
          mongoFilters[field][`$${op}`] = Number.isNaN(maybeNumber) ? finalValue : maybeNumber;
        }

        continue;
      }

      const maybeNumber = Number(finalValue);
      mongoFilters[key] = Number.isNaN(maybeNumber) ? finalValue : maybeNumber;
    }

    // Finding resource
    query = Product.find(mongoFilters);

    // Search logic
    if (req.query.search) {
      query = query.find({
        name: { $regex: req.query.search, $options: 'i' }
      });
    }

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Product.countDocuments();

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const products = await query;

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      pagination,
      data: products
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
exports.getProduct = async (req, res) => {
  try {
    await connectDB();
    
    // Validate MongoDB ObjectId format
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID format' });
    }
    
    const product = await Product.findById(req.params.id).populate('reviews');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({ success: true, data: product });
  } catch (err) {
    console.error('Get Product Error:', err);
    res.status(400).json({ success: false, message: err.message || 'Failed to fetch product' });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Admin/Manager)
exports.createProduct = async (req, res) => {
  try {
    await connectDB();
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Admin/Manager)
exports.updateProduct = async (req, res) => {
  try {
    await connectDB();
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Admin)
exports.deleteProduct = async (req, res) => {
  try {
    await connectDB();
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await product.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Apply or clear offer for a specific product
// @route   PATCH /api/products/:id/offer
// @access  Private (Admin/Manager)
exports.applyProductOffer = async (req, res) => {
  try {
    await connectDB();
    const { discountPercent, clear } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (clear) {
      product.discountPrice = 0;
      product.isGlobalOffer = false;
      await product.save();
      return res.status(200).json({ success: true, data: product, message: 'Product offer removed' });
    }

    const safePercent = Number(discountPercent);
    if (!Number.isFinite(safePercent) || safePercent <= 0 || safePercent >= 100) {
      return res.status(400).json({ success: false, message: 'discountPercent must be between 0 and 100' });
    }

    const discounted = roundPrice(product.price - (product.price * safePercent) / 100);
    product.discountPrice = discounted > 0 ? discounted : 0;
    // mark individual product offers as manual (not global)
    product.isGlobalOffer = false;
    await product.save();

    res.status(200).json({ success: true, data: product, message: 'Product offer applied successfully' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Apply or clear global offer for a category
// @route   PATCH /api/products/offers/global
// @access  Private (Admin/Manager)
exports.applyGlobalOffer = async (req, res) => {
  try {
    await connectDB();
    const { discountPercent, category, clear } = req.body;

    if (!category) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }

    let query = { category };

    if (clear) {
      const products = await Product.find(query);
      const updates = [];
      for (const product of products) {
        if (product.isGlobalOffer) {
          // Restore previous individual discount if it existed
          product.discountPrice = product.previousDiscountPrice || 0;
          product.previousDiscountPrice = 0;
          product.isGlobalOffer = false;
          updates.push(product.save());
        }
      }
      await Promise.all(updates);
      return res.status(200).json({ 
        success: true, 
        message: `Global offer cleared for ${category}. Previous offers restored.`, 
        modifiedCount: updates.length 
      });
    }

    const safePercent = Number(discountPercent);
    if (!Number.isFinite(safePercent) || safePercent <= 0 || safePercent >= 100) {
      return res.status(400).json({ success: false, message: 'discountPercent must be between 0 and 100' });
    }

    const products = await Product.find(query);
    const updates = [];

    for (const product of products) {
      // Store current discountPrice as previous only if not already a global offer
      if (!product.isGlobalOffer) {
        product.previousDiscountPrice = product.discountPrice || 0;
      }
      
      const discounted = roundPrice(product.price - (product.price * safePercent) / 100);
      product.discountPrice = discounted > 0 ? discounted : 0;
      // mark these as global offers so the UI can differentiate
      product.isGlobalOffer = true;
      updates.push(product.save());
    }

    await Promise.all(updates);

    res.status(200).json({ 
      success: true, 
      message: `Global offer of ${safePercent}% applied to ${products.length} ${category} products`,
      count: products.length
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
