const Product = require('../models/Product');

const roundPrice = (value) => Number(Number(value).toFixed(2));

// @desc    Get all products
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    // Mock Data Fallback if DB not connected
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      const mockProducts = [
        {
          _id: 'mock1',
          name: 'Classic Sourdough',
          price: 8.50,
          category: 'Bread',
          description: 'Slow-fermented for 24 hours using organic flour.',
          stock: 20,
          images: ['https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800'],
          averageRating: 4.8
        },
        {
          _id: 'mock2',
          name: 'Velvet Chocolate Cake',
          price: 35.00,
          category: 'Cakes',
          description: 'Triple-layer dark chocolate cake with silky ganache.',
          stock: 5,
          images: ['https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800'],
          averageRating: 4.9,
          discountPrice: 28.00
        },
        {
          _id: 'mock3',
          name: 'Almond Croissant',
          price: 4.75,
          category: 'Pastries',
          description: 'Flaky layers filled with homemade almond cream.',
          stock: 15,
          images: ['https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800'],
          averageRating: 4.7
        },
        {
          _id: 'mock4',
          name: 'Blueberry Muffin',
          price: 3.50,
          category: 'Pastries',
          description: 'Bursting with fresh blueberries and topped with sugar streusel.',
          stock: 25,
          images: ['https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=800'],
          averageRating: 4.6
        },
        {
          _id: 'mock5',
          name: 'Artisanal Baguette',
          price: 5.00,
          category: 'Bread',
          description: 'Traditional French style with a crispy crust and soft airy center.',
          stock: 30,
          images: ['https://images.unsplash.com/photo-1597079910443-60c43fc4f729?w=800'],
          averageRating: 4.5
        },
        {
          _id: 'mock6',
          name: 'Strawberry Tart',
          price: 6.50,
          category: 'Cakes',
          description: 'Buttery shortcrust pastry filled with crème pâtissière and glazed strawberries.',
          stock: 10,
          images: ['https://images.unsplash.com/photo-1464305795204-6f5bdee7351a?w=800'],
          averageRating: 4.8
        }
      ];
      return res.status(200).json({
        success: true,
        count: mockProducts.length,
        pagination: {},
        data: mockProducts,
        message: 'Running in MOCK MODE (No Database Connected)'
      });
    }

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

      if (bracketMatch) {
        const field = bracketMatch[1];
        const op = bracketMatch[2];

        if (!mongoFilters[field] || typeof mongoFilters[field] !== 'object') {
          mongoFilters[field] = {};
        }

        if (op === 'in') {
          mongoFilters[field][`$${op}`] = String(value)
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
        } else {
          const maybeNumber = Number(value);
          mongoFilters[field][`$${op}`] = Number.isNaN(maybeNumber) ? value : maybeNumber;
        }

        continue;
      }

      const maybeNumber = Number(value);
      mongoFilters[key] = Number.isNaN(maybeNumber) ? value : maybeNumber;
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
    const product = await Product.findById(req.params.id).populate('reviews');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Admin/Manager)
exports.createProduct = async (req, res) => {
  try {
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

// @desc    Apply or clear offer for all products (optionally by category)
// @route   PATCH /api/products/offers/global
// @access  Private (Admin/Manager)
exports.applyGlobalOffer = async (req, res) => {
  try {
    const { discountPercent, clear, category } = req.body;
    const filter = {};

    if (category && category !== 'all') {
      filter.category = category;
    }

    const products = await Product.find(filter);

    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'No products found for the selected filter' });
    }

    let updatedCount = 0;

    if (clear) {
      for (const product of products) {
        product.discountPrice = 0;
        await product.save();
        updatedCount += 1;
      }

      return res.status(200).json({
        success: true,
        message: 'Offer removed successfully for selected products',
        updatedCount,
      });
    }

    const safePercent = Number(discountPercent);
    if (!Number.isFinite(safePercent) || safePercent <= 0 || safePercent >= 100) {
      return res.status(400).json({ success: false, message: 'discountPercent must be between 0 and 100' });
    }

    for (const product of products) {
      const discounted = roundPrice(product.price - (product.price * safePercent) / 100);
      product.discountPrice = discounted > 0 ? discounted : 0;
      await product.save();
      updatedCount += 1;
    }

    res.status(200).json({
      success: true,
      message: 'Global offer applied successfully',
      updatedCount,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Apply or clear offer for a specific product
// @route   PATCH /api/products/:id/offer
// @access  Private (Admin/Manager)
exports.applyProductOffer = async (req, res) => {
  try {
    const { discountPercent, clear } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (clear) {
      product.discountPrice = 0;
      await product.save();
      return res.status(200).json({ success: true, data: product, message: 'Product offer removed' });
    }

    const safePercent = Number(discountPercent);
    if (!Number.isFinite(safePercent) || safePercent <= 0 || safePercent >= 100) {
      return res.status(400).json({ success: false, message: 'discountPercent must be between 0 and 100' });
    }

    const discounted = roundPrice(product.price - (product.price * safePercent) / 100);
    product.discountPrice = discounted > 0 ? discounted : 0;
    await product.save();

    res.status(200).json({ success: true, data: product, message: 'Product offer applied successfully' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
