const User = require('../models/User');
const jwt = require('jsonwebtoken');
const connectDB = require('../config/db');
const axios = require('axios');


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
  if (
    message.includes('buffering timed out') || 
    message.includes('Server selection timed out') ||
    message.includes('ECONNREFUSED') ||
    message.includes('querySrv')
  ) {
    return res.status(503).json({
      success: false,
      message: 'Database unavailable. Please check if your IP is whitelisted in MongoDB Atlas.'
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

    const { email, password } = req.body || {};
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

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Google login
// @route   POST /api/auth/google
// @access  Public
exports.googleLogin = async (req, res) => {
  try {
    await connectDB();
    const { idToken, accessToken } = req.body;
    let userData;

    if (idToken) {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      userData = ticket.getPayload();
    } else if (accessToken) {
      // Fetch user info from Google API using access token
      const response = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
      userData = response.data;
    } else {
      return res.status(400).json({ success: false, message: 'Google Token is missing' });
    }

    const { name, email, sub: googleId } = userData;

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = await User.create({
        name,
        email: email.toLowerCase(),
        password: crypto.randomBytes(16).toString('hex'),
        role: 'customer'
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    console.error('Google Login Error:', err);
    return res.status(401).json({ success: false, message: 'Google authentication failed' });
  }
};


const crypto = require('crypto');

const sendEmail = require('../utils/sendEmail');

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    await connectDB();
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'There is no user with that email' });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // Create reset url
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a put request to: \n\n ${resetUrl}`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password reset token',
        message
      });

      res.status(200).json({ success: true, data: 'Email sent' });
    } catch (err) {
      console.log(err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save({ validateBeforeSave: false });

      return res.status(500).json({ success: false, message: 'Email could not be sent' });
    }
  } catch (err) {
    return sendAuthError(res, err, 'Forgot password failed');
  }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    await connectDB();

    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (err) {
    return sendAuthError(res, err, 'Reset password failed');
  }
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

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res) => {
  try {
    await connectDB();
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address
    };

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res) => {
  try {
    await connectDB();
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({ success: false, message: 'Password is incorrect' });
    }

    user.password = req.body.newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Get user wishlist
// @route   GET /api/auth/wishlist
// @access  Private
exports.getWishlist = async (req, res) => {
  try {
    await connectDB();
    const user = await User.findById(req.user.id).populate('wishlist');
    res.status(200).json({ success: true, data: user.wishlist });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Toggle item in wishlist
// @route   POST /api/auth/wishlist/:productId
// @access  Private
exports.toggleWishlist = async (req, res) => {
  try {
    await connectDB();
    const user = await User.findById(req.user.id);
    const productId = req.params.productId;
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isLiked = user.wishlist.some(id => id.toString() === productId);

    let updatedUser;
    if (isLiked) {
      updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { $pull: { wishlist: productId } },
        { new: true }
      ).populate('wishlist');
    } else {
      updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { $addToSet: { wishlist: productId } },
        { new: true }
      ).populate('wishlist');
    }

    res.status(200).json({ success: true, data: updatedUser.wishlist });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
