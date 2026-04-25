const User = require('../models/User');
const jwt = require('jsonwebtoken');
const connectDB = require('../config/db');

const normalizeEmail = (value = '') => value.trim().toLowerCase();
const hasJwtSecret = () => Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.trim());
const pickRequestPayload = (req) => {
  if (req.body && Object.keys(req.body).length > 0) {
    return req.body;
  }
  if (req.query && Object.keys(req.query).length > 0) {
    return req.query;
  }
  return {};
};

const sendAuthError = (res, err, fallbackMessage) => {
  const message = err?.message || fallbackMessage;

  if (err?.code === 11000 && err?.keyPattern?.email) {
    return res.status(409).json({
      success: false,
      message: 'An account with this email already exists'
    });
  }

  if (err?.name === 'ValidationError') {
    return res.status(400).json({ success: false, message });
  }

  // Surface DB connectivity issues clearly instead of generic 400/500 messages.
  if (message.includes('buffering timed out') || message.includes('Server selection timed out')) {
    return res.status(503).json({
      success: false,
      message: 'Database unavailable. Please try again shortly.'
    });
  }

  return res.status(500).json({ success: false, message: message || fallbackMessage });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    await connectDB();

    const { name, email, password } = req.body || {};
    const normalizedName = (name || '').trim();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedName || !normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User already exists with this email' });
    }

    if (!hasJwtSecret()) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: JWT secret is missing'
      });
    }

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password
    });

    sendTokenResponse(user, 201, res);
  } catch (err) {
    return sendAuthError(res, err, 'Registration failed');
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    await connectDB();

    const { email, password } = pickRequestPayload(req);
    const normalizedEmail = normalizeEmail(email);

    // Validate email & password
    if (!normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'Please provide an email and password' });
    }

    if (!hasJwtSecret()) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: JWT secret is missing'
      });
    }

    // Check for user
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    return sendAuthError(res, err, 'Login failed');
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  await connectDB();
  const user = await User.findById(req.user.id);
  res.status(200).json({ success: true, data: user });
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  if (!hasJwtSecret()) {
    return res.status(500).json({
      success: false,
      message: 'Server configuration error: JWT secret is missing'
    });
  }

  // Create token
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
};
